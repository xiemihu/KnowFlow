import io
import re
import json
import base64
import tempfile
import os
import logging

import pdfplumber
from celery import shared_task
from sqlalchemy import select, update

from app.database import async_session
from app.models.resource import Resource, ResourceStatus, ResourceType
from app.models.chunk import Chunk
from app.services.model_adapter import model_adapter

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 80) -> list[dict]:
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current_chunk = ""
    current_idx = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        para_tokens = len(para) // 2

        if len(current_chunk) // 2 + para_tokens > chunk_size and current_chunk:
            chunks.append({
                "content": current_chunk.strip(),
                "seq_index": current_idx,
                "token_count": len(current_chunk) // 2,
            })
            current_idx += 1
            overlap_text = current_chunk[-(overlap * 2):] if len(current_chunk) > overlap * 2 else current_chunk
            current_chunk = overlap_text + "\n" + para
        else:
            current_chunk += "\n" + para if current_chunk else para

    if current_chunk.strip():
        chunks.append({
            "content": current_chunk.strip(),
            "seq_index": current_idx,
            "token_count": len(current_chunk) // 2,
        })

    return chunks


@shared_task(bind=True, max_retries=3)
def parse_resource_task(self, resource_id: str, provider: str, model: str, api_key: str):
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(parse_resource(resource_id, provider, model, api_key))
    finally:
        loop.close()


async def parse_resource(resource_id: str, provider: str, model: str, api_key: str):
    async with async_session() as db:
        result = await db.execute(select(Resource).where(Resource.id == resource_id))
        resource = result.scalar_one_or_none()
        if not resource:
            logger.error(f"Resource {resource_id} not found")
            return

        try:
            await db.execute(
                update(Resource).where(Resource.id == resource_id).values(status=ResourceStatus.PARSING)
            )
            await db.commit()

            file_bytes = await read_from_storage(resource.minio_path)

            if resource.file_type == ResourceType.PDF:
                text = extract_text_from_pdf(file_bytes)
                chunks = chunk_text(text)
            elif resource.file_type == ResourceType.TEXT:
                text = file_bytes.decode("utf-8")
                chunks = chunk_text(text)
            elif resource.file_type == ResourceType.DOCX:
                text = extract_text_from_docx(file_bytes)
                chunks = chunk_text(text)
            elif resource.file_type == ResourceType.IMAGE:
                description = await model_adapter.understand(
                    image_base64=base64.b64encode(file_bytes).decode("utf-8"),
                    prompt="请详细描述这张图片的内容，包括文字、图表、公式等所有信息。",
                    provider=provider,
                    model=model,
                    api_key=api_key,
                )
                chunks = [{"content": description, "seq_index": 0, "token_count": len(description) // 2}]
            elif resource.file_type == ResourceType.AUDIO:
                text = await transcribe_audio(file_bytes, provider, model, api_key)
                chunks = chunk_text(text)
            elif resource.file_type == ResourceType.VIDEO:
                text = await process_video(file_bytes, provider, model, api_key)
                chunks = chunk_text(text)
            else:
                text = file_bytes.decode("utf-8", errors="ignore")
                chunks = chunk_text(text)

            chunk_objs = []
            for chunk_data in chunks:
                chunk = Chunk(
                    resource_id=resource_id,
                    content=chunk_data["content"],
                    seq_index=chunk_data["seq_index"],
                    token_count=chunk_data["token_count"],
                    chunk_metadata=json.dumps({"file_type": resource.file_type.value, "filename": resource.filename}),
                )
                db.add(chunk)
                chunk_objs.append(chunk)

            await db.execute(
                update(Resource).where(Resource.id == resource_id).values(status=ResourceStatus.DONE)
            )
            await db.commit()

            logger.info(f"Resource {resource_id} parsed successfully, {len(chunks)} chunks created")

            from app.services.knowledge_graph import extract_and_merge_knowledge, auto_organize_subject_knowledge
            await extract_and_merge_knowledge(resource.subject_id, resource_id, provider, model, api_key, db)
            await auto_organize_subject_knowledge(resource.subject_id, provider, model, api_key, db)

        except Exception as e:
            await db.execute(
                update(Resource).where(Resource.id == resource_id).values(
                    status=ResourceStatus.FAILED,
                    error_message=str(e)
                )
            )
            await db.commit()
            logger.error(f"Failed to parse resource {resource_id}: {e}")
            raise


async def read_from_storage(minio_path: str) -> bytes:
    from app.config import settings
    from minio import Minio
    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_root_user,
        secret_key=settings.minio_root_password,
        secure=settings.minio_secure,
    )
    bucket = settings.minio_bucket
    path_parts = minio_path.lstrip("/").split("/", 1)
    if len(path_parts) > 1:
        obj_path = path_parts[1]
    else:
        obj_path = path_parts[0]

    response = client.get_object(bucket, obj_path)
    data = response.read()
    response.close()
    return data


async def store_file(subject_id: str, filename: str, file_bytes: bytes) -> str:
    from app.config import settings
    from minio import Minio
    import uuid

    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_root_user,
        secret_key=settings.minio_root_password,
        secure=settings.minio_secure,
    )

    bucket = settings.minio_bucket
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)

    object_name = f"{subject_id}/{uuid.uuid4()}_{filename}"
    client.put_object(bucket, object_name, io.BytesIO(file_bytes), len(file_bytes))
    return f"/{bucket}/{object_name}"


def extract_text_from_docx(file_bytes: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])


async def transcribe_audio(file_bytes: bytes, provider: str, model: str, api_key: str) -> str:
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            tmp.write(file_bytes)
            temp_path = tmp.name

        with open(temp_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")

        prompt = "请完整转写这段音频的内容，保留所有信息。"
        response = await model_adapter.chat(
            messages=[{"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "audio", "audio_url": {"url": f"data:audio/mp3;base64,{audio_b64}"}},
            ]}],
            provider=provider,
            model=model,
            api_key=api_key,
        )
        return response
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


async def process_video(file_bytes: bytes, provider: str, model: str, api_key: str) -> str:
    import subprocess
    temp_video = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(file_bytes)
            temp_video = tmp.name

        frame_dir = tempfile.mkdtemp()
        subprocess.run(
            ["ffmpeg", "-i", temp_video, "-vf", "fps=1", "-frames:v", "5",
             os.path.join(frame_dir, "frame_%03d.jpg")],
            capture_output=True, timeout=120,
        )

        descriptions = []
        for i in range(1, 6):
            frame_path = os.path.join(frame_dir, f"frame_{i:03d}.jpg")
            if os.path.exists(frame_path):
                with open(frame_path, "rb") as f:
                    img_b64 = base64.b64encode(f.read()).decode("utf-8")
                desc = await model_adapter.understand(
                    image_base64=img_b64,
                    prompt="请描述这个视频帧的内容。",
                    provider=provider,
                    model=model,
                    api_key=api_key,
                )
                descriptions.append(f"[帧 {i}]: {desc}")

        audio_path = os.path.join(frame_dir, "audio.mp3")
        subprocess.run(
            ["ffmpeg", "-i", temp_video, "-q:a", "0", "-map", "a", audio_path],
            capture_output=True, timeout=120,
        )

        transcript = ""
        if os.path.exists(audio_path):
            with open(audio_path, "rb") as f:
                audio_b64 = base64.b64encode(f.read()).decode("utf-8")
            transcript = await model_adapter.chat(
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": "请转写这段音频内容。"},
                    {"type": "audio", "audio_url": {"url": f"data:audio/mp3;base64,{audio_b64}"}},
                ]}],
                provider=provider,
                model=model,
                api_key=api_key,
            )

        import shutil
        shutil.rmtree(frame_dir, ignore_errors=True)

        result = "视频内容描述:\n" + "\n".join(descriptions)
        if transcript:
            result += f"\n音频转写:\n{transcript}"
        return result

    finally:
        if temp_video and os.path.exists(temp_video):
            os.unlink(temp_video)
