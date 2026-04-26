import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, func, Table, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

exercise_kp_link = Table(
    "exercise_kp_links",
    Base.metadata,
    Column("exercise_id", UUID(as_uuid=False), ForeignKey("subject_exercises.id", ondelete="CASCADE"), primary_key=True),
    Column("kp_id", UUID(as_uuid=False), ForeignKey("knowledge_points.id", ondelete="CASCADE"), primary_key=True),
)


class SubjectExercise(Base):
    __tablename__ = "subject_exercises"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, default="")
    explanation: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(String(50), default="medium")
    question_type: Mapped[str] = mapped_column(String(50), default="short_answer")
    options: Mapped[str] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(255), default="ai_generated")
    is_correct: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    knowledge_points = relationship("KnowledgePoint", secondary=exercise_kp_link, backref="exercises")
