from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ResourceResponse(BaseModel):
    id: str
    subject_id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ResourceListResponse(BaseModel):
    resources: list[ResourceResponse]
