from sqlalchemy import Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import mapped_column, Mapped
from virtool_core.models.enums import Permission

from virtool.pg.base import Base
from virtool.users.utils import generate_base_permissions


class SQLGroup(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    legacy_id: Mapped[str] = mapped_column(String, nullable=True, unique=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    permissions: Mapped[dict[str, bool]] = mapped_column(JSONB, nullable=False)


def merge_group_permissions(groups: list[dict]) -> dict[str, bool]:
    """
    Return a :class:`dict` of permissions that will be inherited by a user belonging to
    all the passed ``groups``.

    :param groups: a list of group dictionaries
    :return: a dict keyed by permission names with boolean values indicating the state
    of the permission

    """
    permission_dict = generate_base_permissions()

    for p in Permission:
        for group in groups:
            try:
                if group["permissions"][p]:
                    permission_dict[p] = True
            except KeyError:
                permission_dict[p] = False

    return permission_dict
