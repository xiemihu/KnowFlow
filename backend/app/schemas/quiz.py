from pydantic import BaseModel
from typing import Optional


class QuizBatchRequest(BaseModel):
    subject_id: str
    count: int = 3
    difficulty: str = "medium"
    prompt_hint: str = ""
    question_types: list[str] = []


class QuizItem(BaseModel):
    id: str
    type: str
    question: str
    options: Optional[list[str]] = None
    answer: str
    explanation: str
    kp_id: str
    kp_name: str


class QuizBatchResponse(BaseModel):
    exercises: list[QuizItem]
    total: int


class GradeRequest(BaseModel):
    exercise_id: str
    user_answer: str


class GradeResponse(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: str
    kp_id: str
    kp_name: str
    grading_detail: Optional[dict] = None
