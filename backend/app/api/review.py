from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.subject import Subject
from app.schemas.review import ReviewPlanResponse, ReviewGuideResponse
from app.core.deps import get_model_config
from app.services.review_scheduler import generate_review_plan, start_review_guide

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/plan/{subject_id}", response_model=ReviewPlanResponse)
async def get_review_plan(
    subject_id: str,
    user_id: str = "default_user",
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")

    return await generate_review_plan(
        subject_id=subject_id,
        user_id=user_id,
        db=db,
    )


@router.get("/guide/{subject_id}", response_model=ReviewGuideResponse)
async def get_review_guide(
    subject_id: str,
    user_id: str = "default_user",
    config: dict = Depends(get_model_config),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")

    return await start_review_guide(
        subject_id=subject_id,
        user_id=user_id,
        provider=config["provider"],
        model=config["model_id"],
        api_key=config["api_key"],
        db=db,
    )
