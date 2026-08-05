from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class UploadType(str, SQLEnum):
    """Enumerated type for possible upload types"""

    reference = "reference"
    reads = "reads"
    subtraction = "subtraction"


_ALLOWED_UPLOAD_TYPES = ", ".join(repr(value) for value in UploadType.to_list())


class SQLUpload(Base):
    """SQL table to store all new uploads.

    ``storage_key`` holds the upload's complete object-storage key. It is
    nullable because it is derived from ``name_on_disk``, which is itself
    nullable: a row without one names no retrievable object.
    """

    __tablename__ = "uploads"
    __table_args__ = (
        CheckConstraint(
            f"type IN ({_ALLOWED_UPLOAD_TYPES})",
            name="ck_uploads_type",
        ),
        UniqueConstraint("storage_key", name="uq_uploads_storage_key"),
    )

    id: Column = Column(Integer, primary_key=True)
    created_at: Column = Column(DateTime)
    name: Column = Column(String)
    name_on_disk: Column = Column(String, unique=True)
    ready: Column = Column(Boolean, default=False, nullable=False)
    reads: Column = relationship("SQLSampleReads", lazy="joined")
    removed: Column = Column(Boolean, default=False, nullable=False)
    removed_at: Column = Column(DateTime)
    reserved: Column = Column(Boolean, default=False, nullable=False)
    size: Column = Column(BigInteger)
    storage_key: Column = Column(String)
    type: Column = Column(String)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    uploaded_at: Column = Column(DateTime)
