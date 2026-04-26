import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.migration import run_migrations
from app.api import subjects, resources, chat, knowledge, quiz, review, model_config, knowledge_groups, exercises, conversations

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI-StudyCompanion backend...")
    await init_db()
    await run_migrations()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="AI-StudyCompanion API",
    description="以科目为核心的多模态伴学系统后端 API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(subjects.router)
app.include_router(resources.router)
app.include_router(chat.router)
app.include_router(knowledge.router)
app.include_router(quiz.router)
app.include_router(review.router)
app.include_router(model_config.router)
app.include_router(knowledge_groups.router)
app.include_router(exercises.router)
app.include_router(conversations.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name}
