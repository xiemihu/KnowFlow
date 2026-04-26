from pydantic import BaseModel
from typing import Optional


class KnowledgeGraphResponse(BaseModel):
    nodes: list[dict]
    edges: list[dict]


class KnowledgePointItem(BaseModel):
    id: str
    name: str
    description: str
    mastery: float
    resource_count: int
    parent_id: Optional[str] = None


class KnowledgeListResponse(BaseModel):
    knowledge_points: list[KnowledgePointItem]


class SourceChunk(BaseModel):
    id: str
    content: str
    filename: str


class LinkedExercise(BaseModel):
    id: str
    question: str
    difficulty: str
    question_type: str


class KnowledgePointDetail(BaseModel):
    id: str
    name: str
    description: str
    mastery: float
    group_id: Optional[str] = None
    is_important: bool = False
    is_difficult: bool = False
    sources: list[SourceChunk] = []
    exercises: list[LinkedExercise] = []
