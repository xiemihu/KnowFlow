import logging
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import Chunk
from app.models.knowledge_point import KnowledgePoint, KpResourceBinding
from app.services.model_adapter import model_adapter

logger = logging.getLogger(__name__)


async def bm25_search(db: AsyncSession, subject_id: str, query: str, top_k: int = 50) -> list[dict]:
    stmt = text("""
        SELECT c.id, c.content, c.resource_id,
               ts_rank(to_tsvector('simple', c.content), plainto_tsquery('simple', :query)) AS rank
        FROM chunks c
        JOIN resources r ON c.resource_id = r.id
        WHERE r.subject_id = :subject_id
          AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', :query)
        ORDER BY rank DESC
        LIMIT :top_k
    """)
    result = await db.execute(stmt, {"query": query, "subject_id": subject_id, "top_k": top_k})
    rows = result.fetchall()
    return [
        {"id": str(row[0]), "content": row[1], "resource_id": str(row[2]), "rank": float(row[3])}
        for row in rows
    ]


async def get_relevant_kp_context(db: AsyncSession, subject_id: str, query: str, top_k: int = 5) -> str:
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id).limit(20)
    )
    kps = result.scalars().all()

    if not kps:
        return ""

    kp_text = "\n".join([f"- {kp.name}: {kp.description or '无描述'}" for kp in kps])
    return f"科目知识点概览:\n{kp_text}"


async def rag_chat(
    subject_id: str,
    query: str,
    history: list[dict],
    provider: str,
    model: str,
    api_key: str,
    db: AsyncSession,
    use_vector: bool = False,
) -> str:
    chunks = await bm25_search(db, subject_id, query, top_k=50)

    if chunks:
        chunk_texts = [c["content"] for c in chunks]
        reranked_indices = await model_adapter.rerank(
            query=query,
            chunks=chunk_texts,
            provider=provider,
            model=model,
            api_key=api_key,
            top_k=10,
        )
        top_chunks = [chunk_texts[i] for i in reranked_indices if i < len(chunk_texts)]
    else:
        top_chunks = []

    kp_context = await get_relevant_kp_context(db, subject_id, query)

    context = ""
    if kp_context:
        context += f"{kp_context}\n\n"
    if top_chunks:
        context += "相关学习资料片段:\n" + "\n---\n".join(top_chunks)

    messages = []
    if context:
        messages.append({"role": "system", "content": f"你是一位AI学习助手。请基于以下上下文回答学生的问题。如果上下文不足以回答问题，请如实说明。\n\n{context}"})
    else:
        messages.append({"role": "system", "content": "你是一位AI学习助手。当前科目尚无学习资料，请提供一般性的指导。"})

    for msg in history[-10:]:
        messages.append(msg)

    messages.append({"role": "user", "content": query})

    response = await model_adapter.chat(
        messages=messages,
        provider=provider,
        model=model,
        api_key=api_key,
        temperature=0.3,
    )

    return response
