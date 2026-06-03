from sqlalchemy import CheckConstraint, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLSettings(Base):
    __tablename__ = "settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_settings_singleton"),
        CheckConstraint(
            "sample_group IN ('none', 'force_choice', 'users_primary_group')",
            name="ck_settings_sample_group",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    default_source_types: Mapped[list] = mapped_column(JSONB)
    enable_api: Mapped[bool]
    enable_sentry: Mapped[bool]
    minimum_password_length: Mapped[int]
    sample_all_read: Mapped[bool]
    sample_all_write: Mapped[bool]
    sample_group: Mapped[str] = mapped_column(String)
    sample_group_read: Mapped[bool]
    sample_group_write: Mapped[bool]
