import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.subject_exercise import SubjectExercise, exercise_kp_link
from app.models.knowledge_point import KnowledgePoint
from app.models.subject import Subject
from app.schemas.exercise import ExerciseCreate, ExerciseResponse, ExerciseListResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.get("/subject/{subject_id}", response_model=ExerciseListResponse)
async def list_subject_exercises(subject_id: str, kp_id: str = None, db: AsyncSession = Depends(get_db)):
    query = select(SubjectExercise).where(SubjectExercise.subject_id == subject_id)
    if kp_id:
        query = query.where(
            SubjectExercise.id.in_(
                select(exercise_kp_link.c.exercise_id).where(exercise_kp_link.c.kp_id == kp_id)
            )
        )
    query = query.order_by(SubjectExercise.created_at.desc())
    result = await db.execute(query)
    exercises = result.scalars().all()

    items = []
    for ex in exercises:
        kp_result = await db.execute(
            select(KnowledgePoint).join(exercise_kp_link).where(
                exercise_kp_link.c.exercise_id == ex.id
            )
        )
        kps = kp_result.scalars().all()
        items.append(ExerciseResponse(
            id=ex.id,
            subject_id=ex.subject_id,
            question=ex.question,
            answer=ex.answer,
            explanation=ex.explanation,
            difficulty=ex.difficulty,
            question_type=ex.question_type,
            options=ex.options,
            source=ex.source,
            is_correct=ex.is_correct,
            kp_ids=[kp.id for kp in kps],
            kp_names=[kp.name for kp in kps],
            created_at=ex.created_at,
        ))

    return ExerciseListResponse(exercises=items)


@router.get("/{exercise_id}")
async def get_exercise(exercise_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SubjectExercise).where(SubjectExercise.id == exercise_id))
    ex = result.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")

    kp_result = await db.execute(
        select(KnowledgePoint).join(exercise_kp_link).where(
            exercise_kp_link.c.exercise_id == ex.id
        )
    )
    kps = kp_result.scalars().all()

    options_list = json.loads(ex.options) if ex.options else None

    return ExerciseResponse(
        id=ex.id,
        subject_id=ex.subject_id,
        question=ex.question,
        answer=ex.answer,
        explanation=ex.explanation,
        difficulty=ex.difficulty,
        question_type=ex.question_type,
        options=options_list,
        source=ex.source,
        is_correct=ex.is_correct,
        kp_ids=[kp.id for kp in kps],
        kp_names=[kp.name for kp in kps],
        created_at=ex.created_at,
    )


@router.delete("/{exercise_id}", status_code=204)
async def delete_exercise(exercise_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SubjectExercise).where(SubjectExercise.id == exercise_id))
    ex = result.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    await db.delete(ex)
    await db.commit()


@router.post("/save", response_model=ExerciseResponse)
async def save_exercise(data: ExerciseCreate, db: AsyncSession = Depends(get_db)):
    subject_result = await db.execute(select(Subject).where(Subject.id == data.subject_id))
    if not subject_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")

    options_json = json.dumps(data.options) if data.options else None
    ex = SubjectExercise(
        subject_id=data.subject_id,
        question=data.question,
        answer=data.answer,
        explanation=data.explanation or "",
        difficulty=data.difficulty or "medium",
        question_type=data.question_type or "short_answer",
        options=options_json,
        source=data.source or "ai_generated",
    )
    db.add(ex)
    await db.flush()

    if data.kp_ids:
        kp_result = await db.execute(
            select(KnowledgePoint).where(
                KnowledgePoint.id.in_(data.kp_ids),
                KnowledgePoint.subject_id == data.subject_id,
            )
        )
        kps = kp_result.scalars().all()
        for kp in kps:
            await db.execute(
                exercise_kp_link.insert().values(exercise_id=ex.id, kp_id=kp.id)
            )

    await db.commit()
    await db.refresh(ex)

    return ExerciseResponse(
        id=ex.id,
        subject_id=ex.subject_id,
        question=ex.question,
        answer=ex.answer,
        explanation=ex.explanation,
        difficulty=ex.difficulty,
        question_type=ex.question_type,
        options=options_json,
        source=ex.source,
        is_correct=ex.is_correct,
        kp_ids=data.kp_ids or [],
        kp_names=[],
        created_at=ex.created_at,
    )
