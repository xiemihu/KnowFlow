from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ExerciseCreate(BaseModel):
    subject_id: str
    question: str
    answer: str = ""
    explanation: str = ""
    difficulty: str = "medium"
    question_type: str = "short_answer"
    options: list[str] = None
    source: str = "ai_generated"
    kp_ids: list[str] = []


class ExerciseResponse(BaseModel):
    id: str
    subject_id: str
    question: str
    answer: str
    explanation: str
    difficulty: str
    question_type: str
    options: Optional[str] = None
    source: str
    is_correct: bool
    kp_ids: list[str] = []
    kp_names: list[str] = []
    created_at: datetime

    class Config:
        from_attributes = True


class ExerciseListResponse(BaseModel):
    exercises: list[ExerciseResponse]
