from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.model_config import ModelConfigCreate, ModelConfigResponse, ModelConfigInfo
from app.core.model_config_manager import model_config_manager

router = APIRouter(prefix="/api/model-config", tags=["model-config"])

SUPPORTED_PROVIDERS = [
    {"id": "openai", "name": "OpenAI", "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]},
    {"id": "anthropic", "name": "Anthropic", "models": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229"]},
    {"id": "google", "name": "Google Gemini", "models": ["gemini-1.5-pro", "gemini-1.5-flash"]},
    {"id": "aliyun", "name": "阿里通义千问", "models": ["qwen-vl-max", "qwen-vl-plus", "qwen2.5-72b-instruct"]},
    {"id": "deepseek", "name": "DeepSeek", "models": ["deepseek-chat", "deepseek-reasoner"]},
    {"id": "baidu", "name": "百度文心", "models": ["completions_pro", "completions"]},
    {"id": "zhipuai", "name": "智谱AI", "models": ["glm-4v-plus", "glm-4-flash"]},
    {"id": "tencent", "name": "腾讯混元", "models": ["hunyuan-vision", "hunyuan-pro"]},
    {"id": "siliconflow", "name": "SiliconFlow", "models": ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"]},
    {"id": "moonshot", "name": "Moonshot", "models": ["moonshot-v1-8k", "moonshot-v1-32k"]},
]


@router.get("/providers")
async def list_providers():
    return {"providers": SUPPORTED_PROVIDERS}


@router.get("", response_model=ModelConfigInfo)
async def get_config(db: AsyncSession = Depends(get_db)):
    config = await model_config_manager.get_active_config(db)
    if config:
        return ModelConfigInfo(configured=True, provider=config["provider"], model_id=config["model_id"])
    return ModelConfigInfo(configured=False)


@router.post("", response_model=ModelConfigResponse)
async def set_config(data: ModelConfigCreate, user_id: str = "default_user", db: AsyncSession = Depends(get_db)):
    config = await model_config_manager.set_config(
        db=db,
        user_id=user_id,
        provider=data.provider,
        model_id=data.model_id,
        api_key=data.api_key,
        base_url=data.base_url,
    )

    return ModelConfigResponse(
        id=config.id,
        provider=config.provider,
        model_id=config.model_id,
        is_active=config.is_active,
    )
