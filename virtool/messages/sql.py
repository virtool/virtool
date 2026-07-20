from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class MessageColor(str, SQLEnum):
    """Enumerated type for possible instance-message colors."""

    red = "red"
    yellow = "yellow"
    blue = "blue"
    purple = "purple"
    orange = "orange"
    grey = "grey"


_ALLOWED_MESSAGE_COLORS = ", ".join(repr(value) for value in MessageColor.to_list())


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
    __table_args__ = (
        CheckConstraint(
            f"color IN ({_ALLOWED_MESSAGE_COLORS})",
            name="ck_instance_messages_color",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    active = Column(Boolean, default=True)
    color = Column(String, nullable=False)
    message = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    user = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
