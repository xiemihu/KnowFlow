from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.database import get_db
from app.models.chat_message import ChatMessage
from app.models.conversation import Conversation
from app.schemas.chat import ChatRequest, ChatResponse, ChatHistoryResponse
from app.core.deps import get_model_config
from app.services.rag_engine import rag_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/history/{subject_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    subject_id: str,
    conversation_id: str = None,
    user_id: str = "default_user",
    db: AsyncSession = Depends(get_db),
):
    conditions = [ChatMessage.subject_id == subject_id, ChatMessage.user_id == user_id]
    if conversation_id:
        conditions.append(ChatMessage.conversation_id == conversation_id)
    else:
        conditions.append(ChatMessage.conversation_id.is_(None))

    result = await db.execute(
        select(ChatMessage).where(*conditions).order_by(ChatMessage.seq_index).limit(200)
    )
    messages = result.scalars().all()
    return ChatHistoryResponse(messages=[
        {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
        for m in messages
    ])


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    config: dict = Depends(get_model_config),
    db: AsyncSession = Depends(get_db),
):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    conv_id = request.conversation_id
    if conv_id:
        conv_result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
        if not conv_result.scalar_one_or_none():
            conv_id = None

    if not conv_id:
        conv = Conversation(subject_id=request.subject_id, title=query[:50])
        db.add(conv)
        await db.flush()
        conv_id = conv.id

    max_seq = await db.execute(
        select(func.coalesce(func.max(ChatMessage.seq_index), -1)).where(
            ChatMessage.conversation_id == conv_id,
        )
    )
    next_seq = (max_seq.scalar() or -1) + 1

    user_msg = ChatMessage(
        subject_id=request.subject_id,
        conversation_id=conv_id,
        role="user",
        content=query,
        seq_index=next_seq,
    )
    db.add(user_msg)

    history_result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.conversation_id == conv_id,
        ).order_by(ChatMessage.seq_index).limit(100)
    )
    history_msgs = history_result.scalars().all()
    history_for_rag = [{"role": m.role, "content": m.content} for m in history_msgs]

    answer = await rag_chat(
        subject_id=request.subject_id,
        query=query,
        history=history_for_rag,
        provider=config["provider"],
        model=config["model_id"],
        api_key=config["api_key"],
        db=db,
    )

    assistant_msg = ChatMessage(
        subject_id=request.subject_id,
        conversation_id=conv_id,
        role="assistant",
        content=answer,
        seq_index=next_seq + 1,
    )
    db.add(assistant_msg)

    conv = await db.get(Conversation, conv_id)
    if conv:
        conv.updated_at = datetime.now(timezone.utc)

    await db.commit()

    return ChatResponse(answer=answer, message_id=assistant_msg.id, conversation_id=conv_id)
