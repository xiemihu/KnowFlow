import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Integer, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class BKTState(Base):
    __tablename__ = "bkt_states"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    kp_id: Mapped[str] = mapped_column(ForeignKey("knowledge_points.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(255), default="default_user", index=True)

    p_learn: Mapped[float] = mapped_column(Float, default=0.0)
    p_forget: Mapped[float] = mapped_column(Float, default=0.1)
    p_guess: Mapped[float] = mapped_column(Float, default=0.15)
    p_slip: Mapped[float] = mapped_column(Float, default=0.1)
    p_transit: Mapped[float] = mapped_column(Float, default=0.3)
    tau: Mapped[float] = mapped_column(Float, default=30.0)

    last_interaction_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    interaction_count: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    knowledge_point = relationship("KnowledgePoint", back_populates="bkt_states")
