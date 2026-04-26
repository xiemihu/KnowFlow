from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.subject import Subject
from app.models.resource import Resource
from app.models.knowledge_point import KnowledgePoint
from app.models.knowledge_group import KnowledgeGroup
from app.models.bkt_state import BKTState
from app.schemas.subject import SubjectCreate, SubjectUpdate, SubjectResponse, SubjectListResponse

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


async def _build_subject_response(subject: Subject, db: AsyncSession) -> SubjectResponse:
    r_count = await db.execute(
        select(func.count()).select_from(Resource).where(Resource.subject_id == subject.id)
    )
    kp_count = await db.execute(
        select(func.count()).select_from(KnowledgePoint).where(KnowledgePoint.subject_id == subject.id)
    )
    g_count = await db.execute(
        select(func.count()).select_from(KnowledgeGroup).where(KnowledgeGroup.subject_id == subject.id)
    )

    kp_ids_result = await db.execute(
        select(KnowledgePoint.id).where(KnowledgePoint.subject_id == subject.id)
    )
    kp_ids = [row[0] for row in kp_ids_result.fetchall()]
    if kp_ids:
        i_count = await db.execute(
            select(func.coalesce(func.sum(BKTState.interaction_count), 0)).where(
                BKTState.kp_id.in_(kp_ids)
            )
        )
        interaction_count = i_count.scalar() or 0
    else:
        interaction_count = 0

    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        created_at=subject.created_at,
        last_active_at=subject.last_active_at,
        resource_count=r_count.scalar() or 0,
        kp_count=kp_count.scalar() or 0,
        group_count=g_count.scalar() or 0,
        interaction_count=interaction_count,
    )


@router.get("", response_model=SubjectListResponse)
async def list_subjects(user_id: str = "default_user", db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Subject).where(Subject.user_id == user_id).order_by(Subject.last_active_at.desc())
    )
    subjects = result.scalars().all()

    items = []
    for subj in subjects:
        resp = await _build_subject_response(subj, db)
        items.append(resp)

    return SubjectListResponse(subjects=items)


@router.post("", response_model=SubjectResponse, status_code=201)
async def create_subject(data: SubjectCreate, user_id: str = "default_user", db: AsyncSession = Depends(get_db)):
    subject = Subject(user_id=user_id, name=data.name, description=data.description)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)

    return SubjectResponse(
        id=subject.id,
        name=subject.name,
        description=subject.description,
        created_at=subject.created_at,
        last_active_at=subject.last_active_at,
        resource_count=0,
        kp_count=0,
        group_count=0,
        interaction_count=0,
    )


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(subject_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    return await _build_subject_response(subject, db)


@router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(subject_id: str, data: SubjectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if data.name is not None:
        subject.name = data.name
    if data.description is not None:
        subject.description = data.description

    await db.commit()
    await db.refresh(subject)

    return await _build_subject_response(subject, db)


@router.delete("/{subject_id}", status_code=204)
async def delete_subject(subject_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    await db.delete(subject)
    await db.commit()
