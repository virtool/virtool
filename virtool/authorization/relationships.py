from abc import ABC, abstractmethod
from typing import Union

from virtool.authorization.permissions import PermissionType, ResourceType


class AbstractRelationship(ABC):
    @property
    @abstractmethod
    def object_id(self) -> Union[str, int]:
        ...

    @property
    @abstractmethod
    def object_type(self) -> ResourceType:
        ...

    @property
    @abstractmethod
    def user_id(self) -> str:
        ...

    @property
    @abstractmethod
    def user_type(self) -> str:
        ...

    @property
    @abstractmethod
    def relation(self) -> str:
        ...


class GroupMembership(AbstractRelationship):
    def __init__(self, user_id, group_id):
        self._user_id = user_id
        self._group_id = group_id

    @property
    def relation(self):
        return "member"

    @property
    def object_id(self) -> str:
        return self._group_id

    @property
    def object_type(self) -> str:
        return ResourceType.GROUP.value

    @property
    def user_id(self) -> str:
        return self._user_id

    @property
    def user_type(self) -> str:
        return "user"


class GroupPermission(AbstractRelationship):
    def __init__(
        self,
        group_id,
        permission: PermissionType,
    ):
        self._group_id = group_id
        self._permission = permission

    @property
    def object_id(self) -> str:
        return 0

    @property
    def object_type(self) -> str:
        return ResourceType.SPACE.value

    @property
    def relation(self) -> str:
        return self._permission.value.id

    @property
    def user_id(self) -> str:
        return f"{self._group_id}#member"

    @property
    def user_type(self) -> str:
        return "group"


class UserPermission(AbstractRelationship):
    def __init__(self, user_id: Union[int, str], permission: PermissionType):
        self._user_id = user_id
        self._permission = permission

    def __repr__(self):
        return f"UserPermission(user_id={self._user_id}, permission={self._permission}, object_id={self.object_id}, object_type={self.object_type})"

    @property
    def object_id(self) -> Union[int, str]:
        return 0

    @property
    def object_type(self) -> str:
        return ResourceType.SPACE.value

    @property
    def relation(self) -> str:
        return self._permission.value.id

    @property
    def user_id(self) -> Union[int, str]:
        return self._user_id

    @property
    def user_type(self) -> str:
        return "user"
