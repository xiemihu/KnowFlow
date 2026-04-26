from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.model_config import ModelConfig


class ModelConfigManager:
    async def get_active_config(self, db: AsyncSession, user_id: str = "default_user") -> Optional[dict]:
        result = await db.execute(
            select(ModelConfig).where(
                ModelConfig.user_id == user_id,
                ModelConfig.is_active == True
            ).order_by(ModelConfig.updated_at.desc()).limit(1)
        )
        config = result.scalar_one_or_none()
        if not config:
            return None
        return {
            "provider": config.provider,
            "model_id": config.model_id,
            "api_key": config.api_key,
            "base_url": config.base_url,
        }

    async def set_config(self, db: AsyncSession, user_id: str, provider: str, model_id: str, api_key: str, base_url: Optional[str] = None) -> ModelConfig:
        result = await db.execute(
            select(ModelConfig).where(
                ModelConfig.user_id == user_id,
                ModelConfig.is_active == True
            )
        )
        old_configs = result.scalars().all()
        for c in old_configs:
            c.is_active = False

        config = ModelConfig(
            user_id=user_id,
            provider=provider,
            model_id=model_id,
            api_key=api_key,
            base_url=base_url,
            is_active=True,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
        return config


model_config_manager = ModelConfigManager()
