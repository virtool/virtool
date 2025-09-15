from datetime import datetime

from sqlalchemy import Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.associationproxy import AssociationProxy
from sqlalchemy.orm import Mapped, mapped_column, relationship

from virtool.groups.pg import SQLGroup
from virtool.models.roles import AdministratorRole
from virtool.pg.base import Base


class SQLUserGroup(Base):
    __tablename__ = "user_groups"

    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    primary: Mapped[bool] = mapped_column(default=False)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    group: Mapped["SQLGroup"] = relationship(lazy="joined")
    user: Mapped["SQLUser"] = relationship(back_populates="user_group_associations")

    __table_args__ = (
        Index(
            "primary_group_unique",
            primary,
            user_id,
            unique=True,
            postgresql_where=(primary is True),
        ),
    )


class SQLUser(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    active: Mapped[bool] = mapped_column(default=True)
    administrator_role: Mapped[AdministratorRole | None] = mapped_column(
        Enum(AdministratorRole), nullable=True
    )
    b2c_display_name: Mapped[str] = mapped_column(default="")
    b2c_given_name: Mapped[str] = mapped_column(default="")
    b2c_family_name: Mapped[str] = mapped_column(default="")
    b2c_oid: Mapped[str | None]
    email: Mapped[str] = mapped_column(default="", nullable=False)
    force_reset: Mapped[bool] = mapped_column(default=False)
    handle: Mapped[str] = mapped_column(unique=True)
    invalidate_sessions: Mapped[bool] = mapped_column(default=False)
    last_password_change: Mapped[datetime]
    legacy_id: Mapped[str | None] = mapped_column(unique=True)
    password: Mapped[bytes | None]
    settings: Mapped[dict] = mapped_column(JSONB)

    user_group_associations: Mapped[list[SQLUserGroup]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="joined",
    )

    groups: AssociationProxy[list[SQLGroup]] = AssociationProxy(
        "user_group_associations",
        "group",
        creator=lambda group: SQLUserGroup(group=group),
    )

    primary_group_association: Mapped[SQLUserGroup] = relationship(
        back_populates="user",
        lazy="joined",
        primaryjoin="and_(user_groups.c.user_id == SQLUser.id, user_groups.c.primary == True)",
        viewonly=True,
    )

    primary_group: AssociationProxy[SQLGroup] = AssociationProxy(
        "primary_group_association",
        "group",
    )

    def to_dict(self):
        return {
            **super().to_dict(),
            "groups": sorted(self.groups, key=lambda x: x.name),
            "primary_group": self.primary_group,
        }

    def __repr__(self):
        params = ", ".join(
            f"{column}='{type(value).__name__ if column == 'last_password_change' else value}'"
            for column, value in self.to_dict().items()
            if column not in ["password"]
        )

        return f"<{self.__class__.__name__}({params})>"
