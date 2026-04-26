import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.resource import Resource, ResourceType, ResourceStatus
from app.models.subject import Subject
from app.schemas.resource import ResourceResponse, ResourceListResponse
from app.core.deps import get_model_config_optional
from app.services.document_parser import store_file, parse_resource

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resources", tags=["resources"])


FILE_TYPE_MAP = {
    ".pdf": ResourceType.PDF,
    ".png": ResourceType.IMAGE,
    ".jpg": ResourceType.IMAGE,
    ".jpeg": ResourceType.IMAGE,
    ".gif": ResourceType.IMAGE,
    ".webp": ResourceType.IMAGE,
    ".bmp": ResourceType.IMAGE,
    ".mp3": ResourceType.AUDIO,
    ".wav": ResourceType.AUDIO,
    ".flac": ResourceType.AUDIO,
    ".aac": ResourceType.AUDIO,
    ".mp4": ResourceType.VIDEO,
    ".avi": ResourceType.VIDEO,
    ".mov": ResourceType.VIDEO,
    ".mkv": ResourceType.VIDEO,
    ".docx": ResourceType.DOCX,
    ".txt": ResourceType.TEXT,
}


async def _run_parse(resource_id: str, provider: str, model: str, api_key: str):
    try:
        await parse_resource(resource_id, provider, model, api_key)
    except Exception as e:
        logger.error(f"Background parse error for {resource_id}: {e}")


@router.post("/upload", response_model=ResourceResponse, status_code=201)
async def upload_resource(
    subject_id: str = Form(...),
    file: UploadFile = File(...),
    config: dict | None = Depends(get_model_config_optional),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")

    ext = f".{file.filename.split('.')[-1].lower()}" if "." in file.filename else ""
    file_type = FILE_TYPE_MAP.get(ext)
    if not file_type:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    file_bytes = await file.read()
    minio_path = await store_file(subject_id, file.filename, file_bytes)

    resource = Resource(
        subject_id=subject_id,
        filename=file.filename,
        file_type=file_type,
        file_size=len(file_bytes),
        minio_path=minio_path,
        status=ResourceStatus.PENDING,
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)

    if config:
        background_tasks.add_task(
            _run_parse,
            resource.id,
            config["provider"],
            config["model_id"],
            config["api_key"],
        )

    return ResourceResponse(
        id=resource.id,
        subject_id=resource.subject_id,
        filename=resource.filename,
        file_type=resource.file_type.value,
        file_size=resource.file_size,
        status=resource.status.value,
        error_message=resource.error_message,
        created_at=resource.created_at,
    )


@router.get("/subject/{subject_id}", response_model=ResourceListResponse)
async def list_subject_resources(subject_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Resource).where(Resource.subject_id == subject_id).order_by(Resource.created_at.desc())
    )
    resources = result.scalars().all()

    return ResourceListResponse(resources=[
        ResourceResponse(
            id=r.id,
            subject_id=r.subject_id,
            filename=r.filename,
            file_type=r.file_type.value,
            file_size=r.file_size,
            status=r.status.value,
            error_message=r.error_message,
            created_at=r.created_at,
        ) for r in resources
    ])


@router.delete("/{resource_id}", status_code=204)
async def delete_resource(resource_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Resource).where(Resource.id == resource_id))
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    await db.delete(resource)
    await db.commit()
