from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    subject_id: str
    query: str
    history: list[dict[str, object]] = []
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    message_id: Optional[str] = None
    conversation_id: Optional[str] = None


class ChatHistoryResponse(BaseModel):
    messages: list[dict]
