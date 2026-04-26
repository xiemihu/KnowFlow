import json
import logging
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quiz import QuizRecord
from app.models.knowledge_point import KnowledgePoint
from app.models.subject_exercise import SubjectExercise, exercise_kp_link
from app.services.model_adapter import model_adapter
from app.services.bkt_engine import bkt_engine

logger = logging.getLogger(__name__)


async def generate_quiz_batch(
    subject_id: str,
    count: int = 3,
    difficulty: str = "medium",
    prompt_hint: str = "",
    question_types: list[str] = None,
    user_id: str = "default_user",
    provider: str = "",
    model: str = "",
    api_key: str = "",
    db: Optional[AsyncSession] = None,
) -> list[dict]:
    if db is None:
        from app.database import async_session
        async with async_session() as session:
            return await _generate_batch_internal(subject_id, count, difficulty, prompt_hint, question_types, user_id, provider, model, api_key, session)
    return await _generate_batch_internal(subject_id, count, difficulty, prompt_hint, question_types, user_id, provider, model, api_key, db)


async def _generate_batch_internal(
    subject_id: str, count: int, difficulty: str, prompt_hint: str, question_types: list[str],
    user_id: str, provider: str, model: str, api_key: str, db: AsyncSession,
) -> list[dict]:
    weak = await bkt_engine.get_weak_points(db, subject_id, threshold=0.7, user_id=user_id)
    if weak:
        kp_result = weak
    else:
        result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id).limit(10))
        kp_result = [{"id": kp.id, "name": kp.name} for kp in result.scalars().all()]

    if not kp_result:
        return [{"error": "No knowledge points found"}]

    kps_for_llm = []
    for kp in kp_result:
        result = await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == kp["id"]))
        full = result.scalar_one_or_none()
        if full:
            kps_for_llm.append({"name": full.name, "description": full.description or ""})

    if not kps_for_llm:
        return [{"error": "No knowledge points found"}]

    all_generated = []
    total_needed = count

    while len(all_generated) < total_needed:
        remaining = total_needed - len(all_generated)
        batch = await model_adapter.generate_quiz_batch(
            kps=kps_for_llm, difficulty=difficulty, count=remaining,
            prompt_hint=prompt_hint, question_types=question_types or [],
            provider=provider, model=model, api_key=api_key,
            generated_so_far=all_generated,
        )
        for item in batch:
            if len(all_generated) >= total_needed:
                break
            q_type = item.get("type", "subjective")
            q_text = item.get("question", "").strip()
            if not q_text:
                continue

            q_kp_name = item.get("kp_name", "")
            matched_kp = None
            if q_kp_name:
                result = await db.execute(
                    select(KnowledgePoint).where(
                        KnowledgePoint.subject_id == subject_id,
                        KnowledgePoint.name.ilike(f"%{q_kp_name}%"),
                    )
                )
                matched_kp = result.scalar_one_or_none()

            if not matched_kp and kps_for_llm:
                result = await db.execute(
                    select(KnowledgePoint).where(KnowledgePoint.id == kp_result[0]["id"])
                )
                matched_kp = result.scalar_one_or_none()

            options_json = json.dumps(item.get("options", []), ensure_ascii=False) if item.get("options") else None
            exercise = SubjectExercise(
                subject_id=subject_id,
                question=q_text,
                answer=item.get("answer", ""),
                explanation=item.get("explanation", ""),
                difficulty=difficulty,
                question_type=q_type,
                options=options_json,
                source="ai_generated",
            )
            db.add(exercise)
            await db.flush()

            if matched_kp:
                existing = await db.execute(
                    select(exercise_kp_link).where(
                        exercise_kp_link.c.exercise_id == exercise.id,
                        exercise_kp_link.c.kp_id == matched_kp.id,
                    )
                )
                if not existing.fetchone():
                    await db.execute(
                        exercise_kp_link.insert().values(exercise_id=exercise.id, kp_id=matched_kp.id)
                    )

            all_generated.append({
                "id": exercise.id,
                "type": q_type,
                "question": q_text,
                "options": item.get("options"),
                "answer": item.get("answer", ""),
                "explanation": item.get("explanation", ""),
                "kp_id": matched_kp.id if matched_kp else "",
                "kp_name": matched_kp.name if matched_kp else (q_kp_name or ""),
            })

        if len(batch) == 0:
            break

    await db.commit()
    return all_generated


async def submit_and_grade(
    exercise_id: str,
    user_answer: str,
    user_id: str = "default_user",
    provider: str = "",
    model: str = "",
    api_key: str = "",
    db: Optional[AsyncSession] = None,
) -> dict:
    if db is None:
        from app.database import async_session
        async with async_session() as session:
            return await _submit_and_grade_internal(exercise_id, user_answer, user_id, provider, model, api_key, session)
    return await _submit_and_grade_internal(exercise_id, user_answer, user_id, provider, model, api_key, db)


async def _submit_and_grade_internal(
    exercise_id: str, user_answer: str, user_id: str, provider: str, model: str, api_key: str, db: AsyncSession,
) -> dict:
    result = await db.execute(select(SubjectExercise).where(SubjectExercise.id == exercise_id))
    exercise = result.scalar_one_or_none()
    if not exercise:
        return {"error": "Exercise not found"}

    correct_answer = exercise.answer.strip()
    question_type = exercise.question_type

    is_correct = False
    explanation = exercise.explanation or ""
    grading_detail = {}

    if question_type in ("single_choice", "multiple_choice", "fill"):
        user_clean = user_answer.strip().lower()
        correct_clean = correct_answer.lower()
        if question_type == "multiple_choice":
            user_set = set(user_clean.replace(",", "").split())
            correct_set = set(correct_clean.replace(",", "").split())
            is_correct = user_set == correct_set
        else:
            is_correct = user_clean == correct_clean
    else:
        try:
            grading = await model_adapter.grade_subjective(
                question=exercise.question,
                model_answer=correct_answer,
                user_answer=user_answer,
                provider=provider, model=model, api_key=api_key,
            )
            is_correct = grading.get("is_correct", False)
            grading_detail = grading
        except Exception as e:
            logger.error(f"Grading failed: {e}")
            is_correct = False

    kp_id = ""
    kp_name = ""
    kp_link = await db.execute(
        select(KnowledgePoint).join(exercise_kp_link).where(exercise_kp_link.c.exercise_id == exercise_id)
    )
    linked_kp = kp_link.scalar_one_or_none()
    if linked_kp:
        kp_id = linked_kp.id
        kp_name = linked_kp.name
        await bkt_engine.update_after_interaction(db=db, kp_id=kp_id, is_correct=is_correct, user_id=user_id)

    record = QuizRecord(
        user_id=user_id, kp_id=kp_id,
        question=exercise.question, answer=user_answer,
        is_correct=is_correct,
    )
    db.add(record)
    await db.commit()

    return {
        "is_correct": is_correct,
        "correct_answer": correct_answer,
        "explanation": explanation,
        "kp_id": kp_id,
        "kp_name": kp_name,
        "grading_detail": grading_detail,
    }
