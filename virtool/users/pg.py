from __future__ import annotations

from datetime import datetime

from sqlalchemy import  Column, ForeignKey, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from virtool.groups.pg import SQLGroup
from virtool.pg.base import Base

user_group_associations = Table(
    "user_group_associations",
    Base.metadata,
    Column("user_id", ForeignKey("users.id")),
    Column("group_id", ForeignKey("groups.id")),
)


class SQLUser(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    legacy_id: Mapped[str | None] = None
    active: Mapped[bool] = True
    administrator: Mapped[bool] = False
    force_reset: Mapped[bool]
    b2c_display_name: Mapped[str] = ""
    b2c_given_name: Mapped[str] = ""
    b2c_family_name: Mapped[str] = ""
    b2c_oid: Mapped[str] = ""
    force_reset: Mapped[bool] = False
    handle: Mapped[str]
    invalidate_sessions: Mapped[bool] = False
    last_password_change: Mapped[datetime]
    password: Mapped[bytes]

    groups: Mapped[list[SQLGroup]] = relationship(secondary=user_group_associations)

    primary_group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id"))
    primary_group: Mapped[SQLGroup | None] = relationship()

    # TODO: setting relationship
    # TODO: Test that groups works
