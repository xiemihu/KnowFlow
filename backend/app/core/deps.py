from typing import Optional
from fastapi import Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.core.model_config_manager import model_config_manager


async def get_model_config(
    x_provider: Optional[str] = Header(None),
    x_model_id: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if x_provider and x_model_id and x_api_key:
        return {
            "provider": x_provider,
            "model_id": x_model_id,
            "api_key": x_api_key,
        }

    config = await model_config_manager.get_active_config(db)
    if not config:
        raise HTTPException(
            status_code=400,
            detail="No active model configuration found. Please configure your model or provide X-Provider, X-Model-Id, X-Api-Key headers."
        )
    return config


async def get_model_config_optional(
    x_provider: Optional[str] = Header(None),
    x_model_id: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[dict]:
    if x_provider and x_model_id and x_api_key:
        return {
            "provider": x_provider,
            "model_id": x_model_id,
            "api_key": x_api_key,
        }
    return await model_config_manager.get_active_config(db)
