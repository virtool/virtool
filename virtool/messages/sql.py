from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String

from virtool.models.enums import MessageColor
from virtool.pg.base import Base


class SQLInstanceMessage(Base):
    """Schema mirror for the ``instance_messages`` table.

    The feature this backed was removed; no application code reads or writes
    these rows. The class remains so ``Base.metadata`` matches what's in the
    database, preventing ``alembic revision --autogenerate`` from emitting a
    spurious ``drop_table``. Delete in Phase 3 alongside the table.
    """

    __tablename__ = "instance_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    active = Column(Boolean, default=True)
    color = Column(Enum(MessageColor), nullable=False)
    message = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    user = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
