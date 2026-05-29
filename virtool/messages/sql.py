from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String

from virtool.models.enums import MessageColor
from virtool.pg.base import Base


class SQLInstanceMessage(Base):
    """Schema mirror for the ``instance_messages`` table.

    The Python instance-message API was removed; no Python code reads or writes
    these rows. The table itself is **not** dead, however: it is still read and
    written by the TypeScript codebase, so it must remain in the database.

    This class is kept only so ``Base.metadata`` matches what's in the database,
    preventing ``alembic revision --autogenerate`` from emitting a spurious
    ``drop_table``. Do not drop the table or delete this class while the
    TypeScript side still depends on it.
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
