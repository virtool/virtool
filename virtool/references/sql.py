from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Identity,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLReference(Base):
    """SQL model for a reference.

    ``legacy_id`` holds the Mongo ``_id`` and is nullable so references created
    natively in Postgres can omit it. Outbound foreign keys are ``Integer`` to
    match the serial primary key width of the already-migrated targets.

    Several Mongo fields are intentionally dropped: ``space``, ``data_type``
    (re-derived as the constant ``"genome"`` at serialization), and
    ``internal_control``. The denormalized ``cloned_from.name`` snapshot is not
    stored; only ``cloned_from_id`` is kept and the name is re-derived via join.

    The remote-reference fields are all dropped now that the release-check /
    install / update flow is retired: ``release``, ``remotes_from``,
    ``installed``, ``updates`` and ``updating``.
    """

    __tablename__ = "legacy_references"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    legacy_id: Mapped[str | None] = mapped_column(unique=True)
    name: Mapped[str]
    description: Mapped[str]
    organism: Mapped[str] = mapped_column(default="")
    created_at: Mapped[datetime] = mapped_column(DateTime)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    restrict_source_types: Mapped[bool] = mapped_column(Boolean, default=False)
    source_types: Mapped[list] = mapped_column(JSONB, nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    upload_id: Mapped[int | None] = mapped_column(ForeignKey("uploads.id"))
    cloned_from_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("legacy_references.id")
    )
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"))


class SQLReferenceGroup(Base):
    """SQL model for a group's rights on a reference."""

    __tablename__ = "legacy_reference_groups"

    reference_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("legacy_references.id"), primary_key=True
    )
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), primary_key=True)
    build: Mapped[bool] = mapped_column(Boolean, default=False)
    modify: Mapped[bool] = mapped_column(Boolean, default=False)
    modify_otu: Mapped[bool] = mapped_column(Boolean, default=False)
    remove: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime)


class SQLReferenceUser(Base):
    """SQL model for a user's rights on a reference."""

    __tablename__ = "legacy_reference_users"

    reference_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("legacy_references.id"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    build: Mapped[bool] = mapped_column(Boolean, default=False)
    modify: Mapped[bool] = mapped_column(Boolean, default=False)
    modify_otu: Mapped[bool] = mapped_column(Boolean, default=False)
    remove: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime)
