from pydantic import BaseModel


class ReviewPlanResponse(BaseModel):
    total_knowledge_points: int
    average_mastery: float
    mastered: int
    learning: int
    weak: int
    today_review: list[dict]


class ReviewGuideResponse(BaseModel):
    guide: str
    remaining: int
    current_kps: list[dict] = []
    total_weak: int = 0
