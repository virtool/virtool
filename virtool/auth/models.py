from sqlalchemy import Column, Enum, Integer, String

from virtool.pg.base import Base
from virtool.pg.utils import SQLEnum


class ResourceType(str, SQLEnum):
    """
    Enumerated resource type for permissions

    """

    app = "app"
    group = "group"


class ActionType(str, SQLEnum):
    """
    Enumerated action type for permissions
    """
    create = "create"
    update = "update"
    delete = "delete"
    modify = "modify"
    remove = "remove"


class Permission(Base):
    """
    SQL model to store permissions

    """

    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    resource_type = Column(Enum(ResourceType))
    action = Column(Enum(ActionType))

