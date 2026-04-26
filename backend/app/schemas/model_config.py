from pydantic import BaseModel
from typing import Optional


class ModelConfigCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    provider: str
    model_id: str
    api_key: str
    base_url: Optional[str] = None


class ModelConfigResponse(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}
    id: str
    provider: str
    model_id: str
    is_active: bool


class ModelConfigInfo(BaseModel):
    model_config = {"protected_namespaces": ()}
    configured: bool
    provider: Optional[str] = None
    model_id: Optional[str] = None
