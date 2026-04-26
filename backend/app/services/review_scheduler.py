import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
import math

from app.models.knowledge_point import KnowledgePoint, KpResourceBinding
from app.models.bkt_state import BKTState
from app.services.model_adapter import model_adapter

logger = logging.getLogger(__name__)


async def _load_knowledge_with_stats(
    subject_id: str, user_id: str, db: AsyncSession
) -> list[dict]:
    """Single-pass load: KPs + BKT states + resource counts + urgency, all in ~3 queries."""
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id)
    )
    kps = result.scalars().all()

    if not kps:
        return []

    kp_ids = [kp.id for kp in kps]

    bkt_result = await db.execute(
        select(BKTState).where(
            BKTState.kp_id.in_(kp_ids),
            BKTState.user_id == user_id,
        )
    )
    bkt_states = {bs.kp_id: bs for bs in bkt_result.scalars().all()}

    count_result = await db.execute(
        select(KpResourceBinding.kp_id, func.count().label("cnt")).where(
            KpResourceBinding.kp_id.in_(kp_ids)
        ).group_by(KpResourceBinding.kp_id)
    )
    resource_counts = {row[0]: row[1] for row in count_result.fetchall()}

    now = datetime.now(timezone.utc)
    kp_list = []
    for kp in kps:
        state = bkt_states.get(kp.id)
        if state:
            delta_hours = (now - state.last_interaction_at).total_seconds() / 3600.0
            decay = math.exp(-delta_hours / state.tau)
            p_learn = state.p_learn * decay
            urgency = (1 - p_learn) * (delta_hours / state.tau) if state.tau > 0 else 0
            hours_since = delta_hours
        else:
            p_learn = 0.0
            urgency = 0
            hours_since = 0

        kp_list.append({
            "id": kp.id,
            "name": kp.name,
            "description": kp.description,
            "mastery": round(p_learn, 4),
            "resource_count": resource_counts.get(kp.id, 0),
            "urgency": round(urgency, 4),
            "hours_since_review": round(hours_since, 2),
        })

    return kp_list


async def generate_review_plan(
    subject_id: str,
    user_id: str = "default_user",
    db: Optional[AsyncSession] = None,
) -> dict:
    if db is None:
        from app.database import async_session
        async with async_session() as session:
            return await _generate_review_plan_internal(subject_id, user_id, session)
    return await _generate_review_plan_internal(subject_id, user_id, db)


async def _generate_review_plan_internal(
    subject_id: str, user_id: str, db: AsyncSession
) -> dict:
    kp_list = await _load_knowledge_with_stats(subject_id, user_id, db)

    if not kp_list:
        return {
            "total_knowledge_points": 0,
            "average_mastery": 0,
            "mastered": 0,
            "learning": 0,
            "weak": 0,
            "today_review": [],
        }

    today = sorted(kp_list, key=lambda x: x["urgency"], reverse=True)[:20]

    total = len(kp_list)
    avg_mastery = sum(k["mastery"] for k in kp_list) / total

    return {
        "total_knowledge_points": total,
        "average_mastery": round(avg_mastery, 4),
        "mastered": sum(1 for k in kp_list if k["mastery"] >= 0.8),
        "learning": sum(1 for k in kp_list if 0.4 <= k["mastery"] < 0.8),
        "weak": sum(1 for k in kp_list if k["mastery"] < 0.4),
        "today_review": [
            {"id": t["id"], "name": t["name"], "mastery": t["mastery"],
             "urgency": t["urgency"], "description": t.get("description", "")}
            for t in today
        ],
    }


async def start_review_guide(
    subject_id: str,
    user_id: str = "default_user",
    provider: str = "",
    model: str = "",
    api_key: str = "",
    db: Optional[AsyncSession] = None,
) -> dict:
    if db is None:
        from app.database import async_session
        async with async_session() as session:
            return await _start_review_guide_internal(subject_id, user_id, provider, model, api_key, session)
    return await _start_review_guide_internal(subject_id, user_id, provider, model, api_key, db)


async def _start_review_guide_internal(
    subject_id: str, user_id: str, provider: str, model: str, api_key: str, db: AsyncSession
) -> dict:
    kp_list = await _load_knowledge_with_stats(subject_id, user_id, db)
    weak_kps = [k for k in kp_list if k["mastery"] < 0.6]

    if not weak_kps:
        return {"guide": "恭喜！你已经掌握了该科目的所有知识点。", "remaining": 0}

    review_chunk = weak_kps[:5]
    explanation = await model_adapter.generate_review(
        kps=review_chunk,
        provider=provider,
        model=model,
        api_key=api_key,
    )

    return {
        "guide": explanation,
        "remaining": len(weak_kps),
        "current_kps": review_chunk,
        "total_weak": len(weak_kps),
    }
