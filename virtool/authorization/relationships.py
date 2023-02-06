from abc import ABC, abstractmethod
from typing import Union

from virtool.authorization.permissions import PermissionType, ResourceType
from virtool.authorization.roles import SpaceRole, AdministratorRole, RoleType


class AbstractRelationship(ABC):
    exclusive = False
    """
    Whether the relationship is exclusive of other relationships of the same type.
    
    If ``True``, other relationships exist for the sample user-relation-object
    combination, existing relationships will be removed before adding this one.
    
    This takes into account prefixed roles like ``sample_creator``. Only roles with the 
    same prefix are exclusive of each other. For example, if ``sample_editor`` is
    changed to ``sample_viewer``, the ``reference_editor`` relationship will not be
    affected. 
    
    """

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

    def __repr__(self):
        return f"<{self.__class__.__name__} {self.user_type}:{self.user_id} {self.relation} {self.object_id}:{self.object_type}>"


class AdministratorRoleAssignment(AbstractRelationship):
    exclusive = True

    def __init__(self, user_id: Union[int, str], role: AdministratorRole):
        self._user_id = user_id
        self._role = role

    @property
    def object_id(self) -> str:
        return "virtool"

    @property
    def object_type(self) -> str:
        return ResourceType.APP.value

    @property
    def relation(self) -> str:
        return self._role.value

    @property
    def user_id(self) -> Union[int, str]:
        return self._user_id

    @property
    def user_type(self) -> str:
        return "user"


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


class SpaceGroupRoleAssignment(AbstractRelationship):
    exclusive = True

    """
    Represent a group having a base role in a space on that space.

    """

    def __init__(
        self,
        group_id,
        role: RoleType,
    ):
        self._group_id = group_id
        self._role = role

    @property
    def object_id(self) -> int:
        return 0

    @property
    def object_type(self) -> str:
        return ResourceType.SPACE.value

    @property
    def relation(self) -> str:
        return self._role.value

    @property
    def user_id(self) -> str:
        return f"{self._group_id}#member"

    @property
    def user_type(self) -> str:
        return "group"


class SpaceBaseRoleAssignment(AbstractRelationship):
    """
    Represents members of a space having the given base role.

    """

    def __init__(self, space_id: int, role: SpaceRole):
        self._space_id = space_id
        self._role = role

    @property
    def object_id(self) -> int:
        return self._space_id

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


class SpaceUserRoleAssignment(AbstractRelationship):
    """
    Represents a user having a given role in a space.

    """

    def __init__(self, space_id: int, user_id: str, role: SpaceRole):
        self._space_id = space_id
        self._user_id = user_id
        self._role = role

    @property
    def object_id(self) -> int:
        return self._space_id

    @property
    def object_type(self) -> str:
        return ResourceType.SPACE.value

    @property
    def relation(self) -> str:
        return self._role.value

    @property
    def user_id(self) -> str:
        return self._user_id

    @property
    def user_type(self) -> str:
        return "user"


class SpaceGroup(AbstractRelationship):
    """
    Represents a group having a given parent space.
    """

    def __init__(self, group_id, space_id):
        self._group_id = group_id
        self._space_id = space_id

    @property
    def object_id(self) -> int:
        return self._space_id

    @property
    def object_type(self) -> str:
        return ResourceType.SPACE.value

    @property
    def relation(self) -> str:
        return "space"

    @property
    def user_id(self) -> str:
        return self._group_id

    @property
    def user_type(self) -> str:
        return "group"


class SpaceMembership(AbstractRelationship):
    def __init__(self, user_id: Union[int, str], space_id: int):
        self._user_id = user_id
        self._space_id = space_id

    @property
    def object_id(self) -> Union[int, str]:
        return self._space_id

    @property
    def object_type(self) -> str:
        return ResourceType.SPACE.value

    @property
    def relation(self) -> str:
        return "member"

    @property
    def user_id(self) -> Union[int, str]:
        return self._user_id

    @property
    def user_type(self) -> str:
        return "user"
