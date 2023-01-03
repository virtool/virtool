from sqlalchemy import Column, Enum, Integer, String

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class ResourceType(str, SQLEnum):
    """
    Types of resources a permission can apply to (e.g. 'app', 'sample', 'group').

    """

    app = "app"
    group = "group"


class Action(str, SQLEnum):
    """
    Conserved actions that can be performed on a resource and are controlled by permissions.
    """

    create = "create"
    update = "update"
    delete = "delete"
    modify = "modify"
    remove = "remove"


class SQLPermission(Base):
    """
    SQL model to store permissions

    """

    __tablename__ = "permissions"

    id = Column(String, primary_key=True)
    name = Column(String)
    description = Column(String)
    resource_type = Column(Enum(ResourceType))
    action = Column(Enum(Action))
