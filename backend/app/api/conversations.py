from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.database import get_db
from app.models.conversation import Conversation
from app.models.chat_message import ChatMessage

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/subject/{subject_id}")
async def list_conversations(subject_id: str, user_id: str = "default_user", db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(
            Conversation.subject_id == subject_id,
            Conversation.user_id == user_id,
        ).order_by(Conversation.updated_at.desc()).limit(50)
    )
    convs = result.scalars().all()
    items = []
    for c in convs:
        msg_count = await db.execute(
            select(func.count()).select_from(ChatMessage).where(ChatMessage.conversation_id == c.id)
        )
        items.append({
            "id": c.id,
            "title": c.title,
            "message_count": msg_count.scalar() or 0,
            "updated_at": c.updated_at.isoformat(),
            "created_at": c.created_at.isoformat(),
        })
    return {"conversations": items}


@router.post("/subject/{subject_id}")
async def create_conversation(subject_id: str, title: str = "新对话", user_id: str = "default_user", db: AsyncSession = Depends(get_db)):
    conv = Conversation(subject_id=subject_id, user_id=user_id, title=title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return {"id": conv.id, "title": conv.title, "created_at": conv.created_at.isoformat()}


@router.put("/{conversation_id}")
async def rename_conversation(conversation_id: str, title: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.title = title
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": conv.id, "title": conv.title}


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()
