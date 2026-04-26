import math
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bkt_state import BKTState
from app.models.knowledge_point import KnowledgePoint

logger = logging.getLogger(__name__)


class BKTEngine:
    def __init__(self):
        self._cache: dict[str, dict] = {}
        self._last_batch_load: dict[str, float] = {}

    def _cache_key(self, kp_id: str, user_id: str) -> str:
        return f"{user_id}:{kp_id}"

    async def get_state(self, db: AsyncSession, kp_id: str, user_id: str = "default_user") -> BKTState:
        result = await db.execute(
            select(BKTState).where(
                BKTState.kp_id == kp_id,
                BKTState.user_id == user_id,
            )
        )
        state = result.scalar_one_or_none()
        if not state:
            state = BKTState(kp_id=kp_id, user_id=user_id)
            db.add(state)
            await db.flush()
        return state

    async def get_states_batch(self, db: AsyncSession, kp_ids: list[str], user_id: str = "default_user") -> dict[str, BKTState]:
        if not kp_ids:
            return {}
        result = await db.execute(
            select(BKTState).where(
                BKTState.kp_id.in_(kp_ids),
                BKTState.user_id == user_id,
            )
        )
        states = {bs.kp_id: bs for bs in result.scalars().all()}

        for kp_id in kp_ids:
            if kp_id not in states:
                state = BKTState(kp_id=kp_id, user_id=user_id)
                db.add(state)
                states[kp_id] = state
        await db.flush()

        return states

    def _apply_forgetting(self, p_learn: float, last_time: datetime, tau: float) -> float:
        now = datetime.now(timezone.utc)
        delta_hours = (now - last_time).total_seconds() / 3600.0
        decay = math.exp(-delta_hours / tau)
        return p_learn * decay

    def _update_p_learn(self, p_learn: float, p_transit: float, p_guess: float, p_slip: float, is_correct: bool) -> float:
        p_correct = p_learn * (1 - p_slip) + (1 - p_learn) * p_guess

        if p_correct == 0:
            return p_learn

        if is_correct:
            p_updated = (p_learn * (1 - p_slip)) / p_correct
        else:
            p_updated = (p_learn * p_slip) / (1 - p_correct)

        p_updated = p_updated + (1 - p_updated) * p_transit
        return max(0.0, min(1.0, p_updated))

    async def update_after_interaction(
        self,
        db: AsyncSession,
        kp_id: str,
        is_correct: bool,
        user_id: str = "default_user",
    ):
        state = await self.get_state(db, kp_id, user_id)

        p_learn = self._apply_forgetting(state.p_learn, state.last_interaction_at, state.tau)

        state.p_learn = self._update_p_learn(
            p_learn=p_learn,
            p_transit=state.p_transit,
            p_guess=state.p_guess,
            p_slip=state.p_slip,
            is_correct=is_correct,
        )
        state.interaction_count += 1
        if is_correct:
            state.correct_count += 1
        state.last_interaction_at = datetime.now(timezone.utc)

        await db.commit()

        cache_key = self._cache_key(kp_id, user_id)
        self._cache[cache_key] = {
            "p_learn": state.p_learn,
            "last_interaction": state.last_interaction_at,
        }

        return state

    async def get_mastery(self, db: AsyncSession, kp_id: str, user_id: str = "default_user") -> float:
        state = await self.get_state(db, kp_id, user_id)
        p_learn = self._apply_forgetting(state.p_learn, state.last_interaction_at, state.tau)
        state.p_learn = p_learn
        await db.commit()
        return p_learn

    async def _compute_masteries(
        self, db: AsyncSession, subject_id: str, user_id: str
    ) -> tuple[list[dict], dict[str, BKTState]]:
        result = await db.execute(
            select(KnowledgePoint).where(KnowledgePoint.subject_id == subject_id)
        )
        kps = result.scalars().all()

        if not kps:
            return [], {}

        kp_ids = [kp.id for kp in kps]
        states = await self.get_states_batch(db, kp_ids, user_id)

        now = datetime.now(timezone.utc)
        kp_list = []
        for kp in kps:
            state = states.get(kp.id)
            if state:
                p_learn = self._apply_forgetting(state.p_learn, state.last_interaction_at, state.tau)
                hours_since = (now - state.last_interaction_at).total_seconds() / 3600.0
                urgency = (1 - p_learn) * (hours_since / state.tau) if state.tau > 0 else 0
            else:
                p_learn = 0.0
                hours_since = 0
                urgency = 0

            kp_list.append({
                "id": kp.id,
                "name": kp.name,
                "mastery": p_learn,
                "state": state,
                "hours_since_review": hours_since,
                "urgency": urgency,
            })

        return kp_list, states

    async def get_weak_points(
        self,
        db: AsyncSession,
        subject_id: str,
        threshold: float = 0.6,
        user_id: str = "default_user",
    ) -> list[dict]:
        kp_list, _ = await self._compute_masteries(db, subject_id, user_id)

        weak = [
            {"id": k["id"], "name": k["name"], "mastery": k["mastery"]}
            for k in kp_list if k["mastery"] < threshold
        ]

        weak.sort(key=lambda x: x["mastery"])
        return weak

    async def get_review_queue(
        self,
        db: AsyncSession,
        subject_id: str,
        user_id: str = "default_user",
        max_count: int = 10,
    ) -> list[dict]:
        kp_list, _ = await self._compute_masteries(db, subject_id, user_id)

        queue = [
            {
                "id": k["id"],
                "name": k["name"],
                "mastery": k["mastery"],
                "urgency": k["urgency"],
                "hours_since_review": k["hours_since_review"],
            }
            for k in kp_list
        ]

        queue.sort(key=lambda x: x["urgency"], reverse=True)
        return queue[:max_count]


bkt_engine = BKTEngine()
