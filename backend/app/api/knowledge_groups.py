import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.knowledge_group import KnowledgeGroup
from app.models.knowledge_point import KnowledgePoint, KpResourceBinding
from app.models.bkt_state import BKTState
from app.schemas.knowledge_group import (
    KnowledgeGroupCreate, KnowledgeGroupUpdate,
    KnowledgeGroupResponse, KnowledgeGroupListResponse,
    KnowledgeGroupTreeResponse, KnowledgeGroupTreeItem,
)
from app.core.deps import get_model_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/groups", tags=["knowledge-groups"])


@router.get("/subject/{subject_id}", response_model=KnowledgeGroupListResponse)
async def list_groups(subject_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeGroup).where(KnowledgeGroup.subject_id == subject_id).order_by(KnowledgeGroup.sort_order, KnowledgeGroup.created_at)
    )
    groups = result.scalars().all()

    items = []
    for g in groups:
        count = await db.execute(
            select(func.count()).select_from(KnowledgePoint).where(
                KnowledgePoint.group_id == g.id,
                KnowledgePoint.subject_id == subject_id,
            )
        )
        items.append(KnowledgeGroupResponse(
            id=g.id, subject_id=g.subject_id, name=g.name,
            description=g.description, sort_order=g.sort_order,
            kp_count=count.scalar() or 0, created_at=g.created_at,
        ))

    return KnowledgeGroupListResponse(groups=items)


@router.post("/subject/{subject_id}", response_model=KnowledgeGroupResponse, status_code=201)
async def create_group(subject_id: str, data: KnowledgeGroupCreate, db: AsyncSession = Depends(get_db)):
    group = KnowledgeGroup(
        subject_id=subject_id,
        name=data.name,
        description=data.description,
        sort_order=data.sort_order,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return KnowledgeGroupResponse(
        id=group.id, subject_id=group.subject_id, name=group.name,
        description=group.description, sort_order=group.sort_order,
        kp_count=0, created_at=group.created_at,
    )


@router.put("/{group_id}", response_model=KnowledgeGroupResponse)
async def update_group(group_id: str, data: KnowledgeGroupUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeGroup).where(KnowledgeGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if data.name is not None:
        group.name = data.name
    if data.description is not None:
        group.description = data.description
    if data.sort_order is not None:
        group.sort_order = data.sort_order
    await db.commit()
    await db.refresh(group)

    count = await db.execute(
        select(func.count()).select_from(KnowledgePoint).where(KnowledgePoint.group_id == group.id)
    )
    return KnowledgeGroupResponse(
        id=group.id, subject_id=group.subject_id, name=group.name,
        description=group.description, sort_order=group.sort_order,
        kp_count=count.scalar() or 0, created_at=group.created_at,
    )


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeGroup).where(KnowledgeGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    await db.execute(
        delete(KnowledgePoint).where(KnowledgePoint.group_id == group_id)
    )
    await db.delete(group)
    await db.commit()


@router.get("/tree/{subject_id}", response_model=KnowledgeGroupTreeResponse)
async def get_knowledge_tree(subject_id: str, user_id: str = "default_user", db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeGroup).where(KnowledgeGroup.subject_id == subject_id).order_by(KnowledgeGroup.sort_order, KnowledgeGroup.created_at)
    )
    groups = result.scalars().all()

    kp_result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id)
    )
    all_kps = kp_result.scalars().all()

    kp_ids = [kp.id for kp in all_kps]
    bkt_result = await db.execute(
        select(BKTState).where(
            BKTState.kp_id.in_(kp_ids),
            BKTState.user_id == user_id,
        ) if kp_ids else select(BKTState).where(False)
    )
    bkt_map = {bs.kp_id: bs for bs in bkt_result.scalars().all()} if kp_ids else {}

    def kp_to_dict(kp):
        bkt = bkt_map.get(kp.id)
        master = bkt.p_learn if bkt else 0.0
        return {"id": kp.id, "name": kp.name, "description": kp.description, "mastery": master}

    tree_items = []
    for g in groups:
        members = [kp_to_dict(kp) for kp in all_kps if kp.group_id == g.id]
        tree_items.append(KnowledgeGroupTreeItem(
            id=g.id, name=g.name, description=g.description,
            sort_order=g.sort_order, kp_count=len(members),
            knowledge_points=members,
        ))

    ungrouped = [kp_to_dict(kp) for kp in all_kps if not kp.group_id]

    return KnowledgeGroupTreeResponse(groups=tree_items, ungrouped=ungrouped)


@router.post("/auto-group/{subject_id}")
async def auto_group_knowledge(
    subject_id: str,
    config: dict = Depends(get_model_config),
    db: AsyncSession = Depends(get_db),
):
    from app.services.model_adapter import model_adapter
    from app.models.knowledge_point import KnowledgePointRelation

    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id)
    )
    kps = result.scalars().all()

    if not kps:
        raise HTTPException(status_code=400, detail="No knowledge points to group")

    merged_count = 0
    kept_kps = []

    if len(kps) >= 2:
        kp_list = [{"index": i, "name": kp.name, "description": kp.description} for i, kp in enumerate(kps)]

        organized = await model_adapter.auto_organize_knowledge(
            kps=kp_list,
            provider=config["provider"],
            model=config["model_id"],
            api_key=config["api_key"],
        )

        consolidation = organized.get("consolidation", [])
        merge_target_ids = set()
        keep_indices_set = set()

        for item in consolidation:
            keep_idx = item.get("keep_index")
            merge_indices = item.get("merge_indices", [])
            standard_name = item.get("standard_name", "").strip()
            description = item.get("description", "").strip()

            if keep_idx is None or keep_idx >= len(kps):
                continue

            keep_indices_set.add(keep_idx)
            keep_kp = kps[keep_idx]

            if standard_name:
                keep_kp.name = standard_name
            if description:
                keep_kp.description = description

            for merge_idx in merge_indices:
                if merge_idx < len(kps) and merge_idx != keep_idx and merge_idx not in merge_target_ids:
                    merge_kp = kps[merge_idx]
                    merge_target_ids.add(merge_idx)
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
                    await db.delete(merge_kp)
                    merged_count += 1

        kept_kps = [kp for i, kp in enumerate(kps) if i not in merge_target_ids]
    else:
        kept_kps = kps

    if not kept_kps:
        await db.commit()
        return {"groups_created": 0, "total_kps": 0, "merged": merged_count}

    kp_names = [kp.name for kp in kept_kps]
    prompt = f"""请将以下知识点归类，每个类别就是"知识组"。输出JSON格式，每个组包含组名和下属知识点索引。

知识点列表:
{json.dumps([{"i": i, "name": n} for i, n in enumerate(kp_names)], ensure_ascii=False, indent=2)}

输出格式:
[
    {{"group_name": "组名称", "indices": [0, 1, 2]}},
    {{"group_name": "组名称", "indices": [3, 4]}}
]
请确保每个知识点只归入一个组，同组知识点应有逻辑关联。"""

    response = await model_adapter.chat(
        messages=[{"role": "user", "content": prompt}],
        provider=config["provider"],
        model=config["model_id"],
        api_key=config["api_key"],
        temperature=0.1,
    )

    try:
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        grouping = json.loads(cleaned.strip())
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse LLM response: {e}")

    created_count = 0
    for item in grouping:
        group_name = item.get("group_name", "").strip()
        indices = item.get("indices", [])
        if not group_name or not indices:
            continue

        new_group = KnowledgeGroup(subject_id=subject_id, name=group_name)
        db.add(new_group)
        await db.flush()

        for i in indices:
            if 0 <= i < len(kept_kps):
                kept_kps[i].group_id = new_group.id

        created_count += 1

    await db.commit()

    empty_deleted = 0
    empty_result = await db.execute(
        select(KnowledgeGroup).where(KnowledgeGroup.subject_id == subject_id)
    )
    all_groups = empty_result.scalars().all()
    for g in all_groups:
        count = await db.execute(
            select(func.count()).select_from(KnowledgePoint).where(KnowledgePoint.group_id == g.id)
        )
        if (count.scalar() or 0) == 0 and "未分类" not in g.name:
            await db.delete(g)
            empty_deleted += 1

    if empty_deleted:
        await db.commit()

    return {"groups_created": created_count, "total_kps": len(kept_kps), "merged": merged_count, "empty_deleted": empty_deleted}
