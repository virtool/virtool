from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class SubtractionType(str, SQLEnum):
    """Enumerated type for subtraction file types"""

    fasta = "fasta"
    bowtie2 = "bowtie2"


class SQLSubtraction(Base):
    """SQL model for subtraction metadata.

    Column naming convention mirrors :class:`virtool.analyses.sql.SQLAnalysis`:

    - A bare column holds a legacy Mongo string id and has no foreign key,
      because the referenced collection has not been migrated to Postgres.
    - An ``{entity}_id`` column is a real foreign key to an existing SQL table.

    ``legacy_id`` is the Mongo ``_id`` and is nullable so subtractions created
    natively in Postgres can omit it, matching the convention on ``analyses``,
    ``jobs``, ``users``, and ``groups``. The Mongo ``space`` field is
    intentionally dropped.

    ``storage_key`` is the immutable prefix a subtraction's objects live under
    (``subtractions/{storage_key}/``). It is recorded, never derived: backfilled
    rows hold their legacy id slug or old integer prefix, and natively created
    subtractions hold a freshly minted UUID.
    """

    __tablename__ = "subtractions"
    __table_args__ = (UniqueConstraint("job_id"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    legacy_id: Mapped[str | None] = mapped_column(unique=True)
    storage_key: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    nickname: Mapped[str] = mapped_column(default="")
    count: Mapped[int | None]
    gc: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    ready: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"))
    upload_id: Mapped[int | None] = mapped_column(ForeignKey("uploads.id"))


class SQLSubtractionFile(Base):
    """SQL model to store new subtraction files"""

    __tablename__ = "subtraction_files"
    __table_args__ = (
        UniqueConstraint(
            "subtraction_id", "name", name="subtraction_files_subtraction_id_name_key"
        ),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String)
    subtraction_id = Column(BigInteger, ForeignKey("subtractions.id"), nullable=False)
    type = Column(Enum(SubtractionType))
    size = Column(BigInteger)
