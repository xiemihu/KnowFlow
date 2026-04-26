from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.quiz import QuizBatchRequest, QuizBatchResponse, QuizItem, GradeRequest, GradeResponse
from app.core.deps import get_model_config
from app.services.quiz_engine import generate_quiz_batch, submit_and_grade

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


@router.post("/generate-batch", response_model=QuizBatchResponse)
async def generate_batch(
    request: QuizBatchRequest,
    config: dict = Depends(get_model_config),
    db: AsyncSession = Depends(get_db),
):
    count = max(1, min(10, request.count))
    result = await generate_quiz_batch(
        subject_id=request.subject_id,
        count=count,
        difficulty=request.difficulty,
        prompt_hint=request.prompt_hint,
        question_types=request.question_types,
        provider=config["provider"],
        model=config["model_id"],
        api_key=config["api_key"],
        db=db,
    )

    if result and "error" in result[0]:
        raise HTTPException(status_code=400, detail=result[0]["error"])

    exercises = [QuizItem(**item) for item in result if "id" in item]
    return QuizBatchResponse(exercises=exercises, total=len(exercises))


@router.post("/grade", response_model=GradeResponse)
async def grade_exercise(
    request: GradeRequest,
    config: dict = Depends(get_model_config),
    db: AsyncSession = Depends(get_db),
):
    result = await submit_and_grade(
        exercise_id=request.exercise_id,
        user_answer=request.user_answer,
        provider=config["provider"],
        model=config["model_id"],
        api_key=config["api_key"],
        db=db,
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return GradeResponse(**result)
