from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SubjectCreate(BaseModel):
    name: str
    description: str = ""


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class SubjectResponse(BaseModel):
    id: str
    name: str
    description: str
    created_at: datetime
    last_active_at: datetime
    resource_count: int = 0
    kp_count: int = 0
    group_count: int = 0
    interaction_count: int = 0

    class Config:
        from_attributes = True


class SubjectListResponse(BaseModel):
    subjects: list[SubjectResponse]
