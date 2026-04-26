from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class KnowledgeGroupCreate(BaseModel):
    name: str
    description: str = ""
    sort_order: int = 0


class KnowledgeGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class KnowledgeGroupResponse(BaseModel):
    id: str
    subject_id: str
    name: str
    description: str
    sort_order: int
    kp_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeGroupListResponse(BaseModel):
    groups: list[KnowledgeGroupResponse]


class KnowledgeGroupTreeItem(BaseModel):
    id: str
    name: str
    description: str
    sort_order: int
    kp_count: int
    knowledge_points: list[dict]


class KnowledgeGroupTreeResponse(BaseModel):
    groups: list[KnowledgeGroupTreeItem]
    ungrouped: list[dict]
