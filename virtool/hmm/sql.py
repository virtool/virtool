from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Identity
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLHMMStatus(Base):
    """The singleton row describing the installed HMM data and update state.

    The table is named ``legacy_hmm_status`` because the HMM system will be
    rearchitected in the near future. It mirrors the stored shape of the Mongo
    ``status`` singleton rather than the ``HMMStatus`` model: ``updating`` is
    derived from ``updates`` at read time and is not stored.
    """

    __tablename__ = "legacy_hmm_status"
    __table_args__ = (CheckConstraint("id = 1", name="ck_legacy_hmm_status_singleton"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    errors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    release: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    installed: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    updates: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)


class SQLHMM(Base):
    """SQL model for an HMM annotation.

    The integer ``id`` is a Postgres surrogate primary key. The Mongo ``_id`` is
    stored in ``legacy_id``, which is nullable so future Postgres-native
    annotations need not carry one.
    """

    __tablename__ = "hmms"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    legacy_id: Mapped[str | None] = mapped_column(unique=True)
    cluster: Mapped[int]
    count: Mapped[int]
    length: Mapped[int]
    mean_entropy: Mapped[float]
    total_entropy: Mapped[float]
    hidden: Mapped[bool] = mapped_column(default=False)
    names: Mapped[list] = mapped_column(JSONB)
    families: Mapped[dict] = mapped_column(JSONB)
    genera: Mapped[dict] = mapped_column(JSONB)
    entries: Mapped[list] = mapped_column(JSONB)
