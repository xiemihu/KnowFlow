import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class ResourceType(str, enum.Enum):
    PDF = "pdf"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    DOCX = "docx"
    PPTX = "pptx"
    TEXT = "text"


class ResourceStatus(str, enum.Enum):
    PENDING = "pending"
    PARSING = "parsing"
    DONE = "done"
    FAILED = "failed"


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[ResourceType] = mapped_column(Enum(ResourceType), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    minio_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[ResourceStatus] = mapped_column(Enum(ResourceStatus), default=ResourceStatus.PENDING)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subject = relationship("Subject", back_populates="resources")
    chunks = relationship("Chunk", back_populates="resource", cascade="all, delete-orphan")
