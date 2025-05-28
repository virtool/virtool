from sqlalchemy import Column, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from virtool.pg.base import Base


class SQLHistoryDiff(Base):
    """A SQL model for storing history diffs.

    This is a temporary table and should be removed after history has been completely
    reimplemented in Postgres.
    """

    __tablename__ = "history_diffs"

    id = Column(Integer, primary_key=True)
    change_id = Column(String, unique=True)
    diff = Column(JSONB)
