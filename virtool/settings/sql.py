from sqlalchemy import Boolean, CheckConstraint, Column, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from virtool.pg.base import Base


class SQLSettings(Base):
    """The single row of application settings.

    The table holds exactly one row, enforced by the ``id = 1`` check
    constraint. Its columns mirror :class:`virtool.settings.models.Settings`.
    """

    __tablename__ = "settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_settings_singleton"),
        CheckConstraint(
            "sample_group IN ('none', 'force_choice', 'users_primary_group')",
            name="ck_settings_sample_group",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=False)
    default_source_types = Column(JSONB, nullable=False)
    enable_api = Column(Boolean, nullable=False)
    enable_sentry = Column(Boolean, nullable=False)
    minimum_password_length = Column(Integer, nullable=False)
    sample_all_read = Column(Boolean, nullable=False)
    sample_all_write = Column(Boolean, nullable=False)
    sample_group = Column(String, nullable=False)
    sample_group_read = Column(Boolean, nullable=False)
    sample_group_write = Column(Boolean, nullable=False)
