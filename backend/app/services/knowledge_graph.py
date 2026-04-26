import logging
import re
from typing import Optional
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_point import KnowledgePoint, KnowledgePointRelation, KpResourceBinding, RelationType
from app.models.knowledge_group import KnowledgeGroup
from app.models.chunk import Chunk
from app.services.model_adapter import model_adapter
from app.models.bkt_state import BKTState

logger = logging.getLogger(__name__)


def normalize_entity_name(name: str) -> str:
    name = re.sub(r'[的之]', '', name)
    name = re.sub(r'\s+', '', name)
    name = name.strip(' .。，,；;：:""''【】《》（）()「」『』')
    return name.lower()


async def find_similar_kp(db: AsyncSession, subject_id: str, raw_name: str) -> Optional[KnowledgePoint]:
    normalized = normalize_entity_name(raw_name)
    if not normalized:
        return None

    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id)
    )
    all_kps = result.scalars().all()

    for kp in all_kps:
        if normalize_entity_name(kp.name) == normalized:
            return kp

    for kp in all_kps:
        kp_norm = normalize_entity_name(kp.name)
        if normalized in kp_norm or kp_norm in normalized:
            if len(normalized) >= 2 and len(kp_norm) >= 2:
                return kp

    return None


async def extract_and_merge_knowledge(
    subject_id: str,
    resource_id: str,
    provider: str,
    model: str,
    api_key: str,
    db: AsyncSession,
):
    result = await db.execute(
        select(Chunk).where(Chunk.resource_id == resource_id).order_by(Chunk.seq_index)
    )
    chunks = result.scalars().all()

    all_triples = []
    for chunk in chunks:
        triples = await model_adapter.extract_knowledge(
            text=chunk.content,
            provider=provider,
            model=model,
            api_key=api_key,
        )
        for t in triples:
            t["chunk_id"] = chunk.id
        all_triples.extend(triples)

    if all_triples:
        await merge_triples(subject_id, all_triples, resource_id, db)

    logger.info(f"Knowledge extracted: {len(all_triples)} triples from resource {resource_id}")


async def merge_triples(subject_id: str, triples: list[dict], resource_id: str, db: AsyncSession):
    for triple in triples:
        entity_name = triple.get("entity", "").strip()
        target_name = triple.get("target", "").strip()
        relation_type_str = triple.get("relation_type", "related")
        try:
            relation_type = RelationType(relation_type_str)
        except ValueError:
            relation_type = RelationType.RELATED

        if not entity_name:
            continue

        source_kp = await get_or_create_kp(db, subject_id, entity_name)
        chunk_id = triple.get("chunk_id")
        if chunk_id:
            existing = await db.execute(
                select(KpResourceBinding).where(
                    KpResourceBinding.kp_id == source_kp.id,
                    KpResourceBinding.chunk_id == chunk_id,
                )
            )
            if not existing.scalar_one_or_none():
                binding = KpResourceBinding(kp_id=source_kp.id, chunk_id=chunk_id, relevance_score=0.8)
                db.add(binding)

        if target_name:
            target_kp = await get_or_create_kp(db, subject_id, target_name)

            existing = await db.execute(
                select(KnowledgePointRelation).where(
                    KnowledgePointRelation.source_kp_id == source_kp.id,
                    KnowledgePointRelation.target_kp_id == target_kp.id,
                )
            )
            if not existing.scalar_one_or_none():
                relation = KnowledgePointRelation(
                    source_kp_id=source_kp.id,
                    target_kp_id=target_kp.id,
                    relation_type=relation_type,
                    confidence=triple.get("confidence", 0.8),
                )
                db.add(relation)

            if chunk_id:
                existing = await db.execute(
                    select(KpResourceBinding).where(
                        KpResourceBinding.kp_id == target_kp.id,
                        KpResourceBinding.chunk_id == chunk_id,
                    )
                )
                if not existing.scalar_one_or_none():
                    binding = KpResourceBinding(kp_id=target_kp.id, chunk_id=chunk_id, relevance_score=0.7)
                    db.add(binding)

    await db.commit()


async def get_or_create_kp(db: AsyncSession, subject_id: str, name: str) -> KnowledgePoint:
    similar = await find_similar_kp(db, subject_id, name)
    if similar:
        return similar

    kp = KnowledgePoint(subject_id=subject_id, name=name)
    db.add(kp)
    await db.flush()

    bkt = BKTState(kp_id=kp.id, user_id="default_user")
    db.add(bkt)

    return kp


async def get_subject_knowledge_graph(subject_id: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id)
    )
    nodes = result.scalars().all()

    if not nodes:
        return {"nodes": [], "edges": []}

    node_ids = [n.id for n in nodes]
    result2 = await db.execute(
        select(KnowledgePointRelation).where(
            (KnowledgePointRelation.source_kp_id.in_(node_ids)) |
            (KnowledgePointRelation.target_kp_id.in_(node_ids))
        )
    )
    edges = result2.scalars().all()

    return {
        "nodes": [{"id": n.id, "name": n.name, "description": n.description} for n in nodes],
        "edges": [
            {
                "source": e.source_kp_id,
                "target": e.target_kp_id,
                "relation_type": e.relation_type.value,
                "confidence": e.confidence,
            }
            for e in edges
        ],
    }


async def get_subject_knowledge_list(subject_id: str, user_id: str, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id)
    )
    kps = result.scalars().all()

    if not kps:
        return []

    kp_ids = [kp.id for kp in kps]

    bkt_result = await db.execute(
        select(BKTState).where(
            BKTState.kp_id.in_(kp_ids),
            BKTState.user_id == user_id,
        )
    )
    bkt_states = {bs.kp_id: bs for bs in bkt_result.scalars().all()}

    count_result = await db.execute(
        select(KpResourceBinding.kp_id, func.count().label("cnt")).where(
            KpResourceBinding.kp_id.in_(kp_ids)
        ).group_by(KpResourceBinding.kp_id)
    )
    resource_counts = {row[0]: row[1] for row in count_result.fetchall()}

    return [
        {
            "id": kp.id,
            "name": kp.name,
            "description": kp.description,
            "mastery": bkt_states[kp.id].p_learn if kp.id in bkt_states else 0.0,
            "resource_count": resource_counts.get(kp.id, 0),
            "parent_id": kp.parent_id,
            "is_important": kp.is_important,
            "is_difficult": kp.is_difficult,
        }
        for kp in kps
    ]


async def auto_organize_subject_knowledge(
    subject_id: str,
    provider: str,
    model: str,
    api_key: str,
    db: AsyncSession,
):
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id)
    )
    kps = result.scalars().all()

    if len(kps) < 2:
        logger.info(f"Subject {subject_id} has {len(kps)} KPs, skipping auto-organize")
        return

    kp_list = [{"index": i, "name": kp.name, "description": kp.description} for i, kp in enumerate(kps)]

    organized = await model_adapter.auto_organize_knowledge(
        kps=kp_list,
        provider=provider,
        model=model,
        api_key=api_key,
    )

    consolidation = organized.get("consolidation", [])
    groups_def = organized.get("groups", [])

    merged_kp_ids = set()
    kept_kp_map = {}

    for item in consolidation:
        keep_idx = item.get("keep_index")
        merge_indices = item.get("merge_indices", [])
        standard_name = item.get("standard_name", "").strip()
        description = item.get("description", "").strip()

        if keep_idx is None or keep_idx >= len(kps):
            continue

        keep_kp = kps[keep_idx]
        all_merge = [keep_idx] + list(merge_indices)

        for merge_idx in merge_indices:
            if merge_idx < len(kps) and merge_idx != keep_idx:
                merge_kp = kps[merge_idx]
                await db.execute(
                    delete(KpResourceBinding).where(KpResourceBinding.kp_id == merge_kp.id)
                )
                await db.execute(
                    delete(KnowledgePointRelation).where(
                        (KnowledgePointRelation.source_kp_id == merge_kp.id) |
                        (KnowledgePointRelation.target_kp_id == merge_kp.id)
                    )
                )
                await db.execute(
                    delete(BKTState).where(BKTState.kp_id == merge_kp.id)
                )
                for rel_idx in all_merge:
                    if rel_idx < len(kps) and rel_idx != merge_idx:
                        ref_kp = kps[rel_idx]
                        existing = await db.execute(
                            select(KpResourceBinding).where(
                                KpResourceBinding.kp_id == ref_kp.id,
                                KpResourceBinding.chunk_id.isnot(None),
                            )
                        )
                        for binding in existing.scalars().all():
                            exists = await db.execute(
                                select(KpResourceBinding).where(
                                    KpResourceBinding.kp_id == keep_kp.id,
                                    KpResourceBinding.chunk_id == binding.chunk_id,
                                )
                            )
                            if not exists.scalar_one_or_none():
                                rebind = KpResourceBinding(
                                    kp_id=keep_kp.id,
                                    chunk_id=binding.chunk_id,
                                    relevance_score=binding.relevance_score,
                                )
                                db.add(rebind)
                await db.delete(merge_kp)
                merged_kp_ids.add(merge_kp.id)

        if standard_name:
            keep_kp.name = standard_name
        if description:
            keep_kp.description = description

        kept_kp_map[keep_idx] = keep_kp

    for group_def in groups_def:
        group_name = group_def.get("group_name", "").strip()
        kp_indices = group_def.get("kp_indices", [])
        if not group_name or not kp_indices:
            continue

        new_group = KnowledgeGroup(subject_id=subject_id, name=group_name)
        db.add(new_group)
        await db.flush()

        for ci in kp_indices:
            if ci < len(consolidation):
                consol_item = consolidation[ci]
                keep_idx = consol_item.get("keep_index")
                if keep_idx is not None and keep_idx < len(kps) and keep_idx not in merged_kp_ids:
                    kp = kps[keep_idx]
                    kp.group_id = new_group.id

    await db.commit()
    logger.info(f"Auto-organize complete for subject {subject_id}: "
                f"{len(consolidation)} consolidated KPs, {len(groups_def)} groups, "
                f"{len(merged_kp_ids)} duplicates merged")
