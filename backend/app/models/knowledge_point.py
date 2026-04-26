import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Float, ForeignKey, Enum, Boolean, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class RelationType(str, enum.Enum):
    PREREQUISITE = "prerequisite"
    IS_A = "is_a"
    RELATED = "related"
    DERIVED = "derived"


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("knowledge_groups.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    parent_id: Mapped[str] = mapped_column(ForeignKey("knowledge_points.id", ondelete="SET NULL"), nullable=True)
    is_important: Mapped[bool] = mapped_column(Boolean, default=False)
    is_difficult: Mapped[bool] = mapped_column(Boolean, default=False)
    kp_metadata: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subject = relationship("Subject", back_populates="knowledge_points")
    group = relationship("KnowledgeGroup", back_populates="knowledge_points")
    parent = relationship("KnowledgePoint", remote_side="KnowledgePoint.id", backref="children")
    source_relations = relationship("KnowledgePointRelation", foreign_keys="KnowledgePointRelation.source_kp_id", back_populates="source", cascade="all, delete-orphan")
    target_relations = relationship("KnowledgePointRelation", foreign_keys="KnowledgePointRelation.target_kp_id", back_populates="target", cascade="all, delete-orphan")
    kp_bindings = relationship("KpResourceBinding", back_populates="knowledge_point", cascade="all, delete-orphan")
    bkt_states = relationship("BKTState", back_populates="knowledge_point", cascade="all, delete-orphan")
    quiz_records = relationship("QuizRecord", back_populates="knowledge_point", cascade="all, delete-orphan")
    quiz_variants = relationship("QuizVariant", back_populates="knowledge_point", cascade="all, delete-orphan")


class KnowledgePointRelation(Base):
    __tablename__ = "kp_relations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_kp_id: Mapped[str] = mapped_column(ForeignKey("knowledge_points.id", ondelete="CASCADE"), nullable=False, index=True)
    target_kp_id: Mapped[str] = mapped_column(ForeignKey("knowledge_points.id", ondelete="CASCADE"), nullable=False, index=True)
    relation_type: Mapped[RelationType] = mapped_column(Enum(RelationType), default=RelationType.RELATED)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    source = relationship("KnowledgePoint", foreign_keys=[source_kp_id], back_populates="source_relations")
    target = relationship("KnowledgePoint", foreign_keys=[target_kp_id], back_populates="target_relations")


class KpResourceBinding(Base):
    __tablename__ = "kp_resource_bindings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    kp_id: Mapped[str] = mapped_column(ForeignKey("knowledge_points.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_id: Mapped[str] = mapped_column(ForeignKey("chunks.id", ondelete="CASCADE"), nullable=False, index=True)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    knowledge_point = relationship("KnowledgePoint", back_populates="kp_bindings")
    chunk = relationship("Chunk", back_populates="kp_bindings")
