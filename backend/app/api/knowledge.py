import logging
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.subject import Subject
from app.models.knowledge_point import KnowledgePoint, KpResourceBinding
from app.models.knowledge_group import KnowledgeGroup
from app.models.chunk import Chunk
from app.models.bkt_state import BKTState
from app.models.resource import Resource
from app.models.subject_exercise import SubjectExercise, exercise_kp_link
from app.schemas.knowledge import (
    KnowledgeGraphResponse, KnowledgeListResponse, KnowledgePointItem,
    KnowledgePointDetail, SourceChunk, LinkedExercise,
)
from app.services.knowledge_graph import get_subject_knowledge_graph, get_subject_knowledge_list

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.get("/graph/{subject_id}", response_model=KnowledgeGraphResponse)
async def get_knowledge_graph(subject_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")
    return await get_subject_knowledge_graph(subject_id, db)


@router.get("/list/{subject_id}", response_model=KnowledgeListResponse)
async def get_knowledge_list(subject_id: str, user_id: str = "default_user", db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")
    kps = await get_subject_knowledge_list(subject_id, user_id, db)
    return KnowledgeListResponse(knowledge_points=[
        KnowledgePointItem(**kp) for kp in kps
    ])


@router.get("/search/{subject_id}")
async def search_knowledge_points(
    subject_id: str, q: str = "",
    user_id: str = "default_user", db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")

    if not q.strip():
        return await get_subject_knowledge_list(subject_id, user_id, db)

    stmt = select(KnowledgePoint).where(
        KnowledgePoint.subject_id == subject_id,
        KnowledgePoint.name.ilike(f"%{q}%"),
    )
    kp_result = await db.execute(stmt)
    kps = kp_result.scalars().all()

    kp_ids = [kp.id for kp in kps]
    bkt_result = await db.execute(
        select(BKTState).where(BKTState.kp_id.in_(kp_ids), BKTState.user_id == user_id)
        if kp_ids else select(BKTState).where(False)
    )
    bkt_map = {bs.kp_id: bs for bs in bkt_result.scalars().all()} if kp_ids else {}

    return [
        {
            "id": kp.id,
            "name": kp.name,
            "description": kp.description,
            "mastery": bkt_map[kp.id].p_learn if kp.id in bkt_map else 0.0,
        }
        for kp in kps
    ]


@router.get("/detail/{kp_id}", response_model=KnowledgePointDetail)
async def get_knowledge_point_detail(kp_id: str, user_id: str = "default_user", db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == kp_id))
    kp = result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="Knowledge point not found")

    bkt_result = await db.execute(
        select(BKTState).where(BKTState.kp_id == kp_id, BKTState.user_id == user_id)
    )
    bkt = bkt_result.scalar_one_or_none()
    mastery = bkt.p_learn if bkt else 0.0

    binding_result = await db.execute(
        select(KpResourceBinding).where(KpResourceBinding.kp_id == kp_id)
    )
    bindings = binding_result.scalars().all()
    sources = []
    for binding in bindings:
        chunk_result = await db.execute(select(Chunk).where(Chunk.id == binding.chunk_id))
        chunk = chunk_result.scalar_one_or_none()
        if chunk:
            resource_result = await db.execute(select(Resource).where(Resource.id == chunk.resource_id))
            resource = resource_result.scalar_one_or_none()
            sources.append(SourceChunk(
                id=chunk.id,
                content=chunk.content[:500],
                filename=resource.filename if resource else "unknown",
            ))

    exercise_result = await db.execute(
        select(SubjectExercise).join(exercise_kp_link).where(
            exercise_kp_link.c.kp_id == kp_id
        ).order_by(SubjectExercise.created_at.desc()).limit(20)
    )
    linked_exercises = [
        LinkedExercise(id=ex.id, question=ex.question[:200], difficulty=ex.difficulty, question_type=ex.question_type)
        for ex in exercise_result.scalars().all()
    ]

    return KnowledgePointDetail(
        id=kp.id,
        name=kp.name,
        description=kp.description,
        mastery=mastery,
        group_id=kp.group_id,
        is_important=kp.is_important,
        is_difficult=kp.is_difficult,
        sources=sources,
        exercises=linked_exercises,
    )


@router.put("/point/{kp_id}")
async def update_knowledge_point(
    kp_id: str,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == kp_id))
    kp = result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="Knowledge point not found")

    if "name" in data:
        kp.name = data["name"]
    if "description" in data:
        kp.description = data["description"]
    if "is_important" in data:
        kp.is_important = bool(data["is_important"])
    if "is_difficult" in data:
        kp.is_difficult = bool(data["is_difficult"])
    await db.commit()
    return {"id": kp.id, "name": kp.name, "description": kp.description, "is_important": kp.is_important, "is_difficult": kp.is_difficult}


@router.delete("/point/{kp_id}", status_code=204)
async def delete_knowledge_point(kp_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == kp_id))
    kp = result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="Knowledge point not found")
    await db.delete(kp)
    await db.commit()


@router.post("/batch-delete", status_code=204)
async def batch_delete_knowledge_points(
    kp_ids: list[str] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    if not kp_ids:
        raise HTTPException(status_code=400, detail="No knowledge point IDs provided")
    for kp_id in kp_ids:
        result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == kp_id))
        kp = result.scalar_one_or_none()
        if kp:
            await db.delete(kp)
    await db.commit()


@router.delete("/subject/{subject_id}", status_code=204)
async def clear_subject_knowledge(subject_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")
    kp_result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id)
    )
    for kp in kp_result.scalars().all():
        await db.delete(kp)
    await db.commit()


@router.post("/point/{kp_id}/move/{group_id}", status_code=204)
async def move_kp_to_group(kp_id: str, group_id: str, db: AsyncSession = Depends(get_db)):
    kp_result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == kp_id))
    kp = kp_result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="Knowledge point not found")
    if group_id == "none":
        kp.group_id = None
        await db.commit()
        return
    grp_result = await db.execute(select(KnowledgeGroup).where(KnowledgeGroup.id == group_id))
    if not grp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")
    kp.group_id = group_id
    await db.commit()
