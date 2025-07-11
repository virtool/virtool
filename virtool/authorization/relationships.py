"""Classes that represent relationships between users and other resources."""

from abc import ABC, abstractmethod

from openfga_sdk import OpenFgaApi, ReadRequest, TupleKey, TupleKeys, WriteRequest

from virtool.authorization.permissions import ResourceType
from virtool.models.roles import (
    AdministratorRole,
    ReferenceRole,
    SpaceRole,
    SpaceRoleType,
)


class AbstractRelationship(ABC):
    exclusive = False
    """
    Whether the relationship is exclusive of other relationships of the same type.

    Relationships are exclusive. If other relationships exist for the
    sample user-relation-object combination, existing relationships
    will be removed before adding this one.

    This takes into account prefixed roles like ``sample_creator``. Only roles with the
    same prefix are exclusive of each other. For example, if ``sample_editor`` is
    changed to ``sample_viewer``, the ``reference_editor`` relationship will not be
    affected.

    """

    @property
    @abstractmethod
    def object_id(self) -> str | int: ...

    @property
    @abstractmethod
    def object_type(self) -> ResourceType: ...

    @property
    @abstractmethod
    def user_id(self) -> str: ...

    @property
    @abstractmethod
    def user_type(self) -> str: ...

    @property
    @abstractmethod
    def relation(self) -> str: ...

    def __repr__(self):
        return f"<{self.__class__.__name__} {self.user_type}:{self.user_id} {self.relation} {self.object_id}:{self.object_type}>"

    async def remove_tuples(self, openfga: OpenFgaApi, add_list: list) -> None:
        for request in add_list:
            relation_tuple = request.writes.tuple_keys[0]

            if (
                relation_tuple.object == f"{self.object_type}:{self.object_id}"
                and relation_tuple.user == f"{self.user_type}:{self.user_id}"
            ):
                add_list.remove(request)

        response = await openfga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"{self.user_type}:{self.user_id}",
                    object=f"{self.object_type}:{self.object_id}",
                ),
            )
        )

        if response.tuples:
            await openfga.write(
                WriteRequest(
                    deletes=TupleKeys(
                        [response_tuple.key for response_tuple in response.tuples]
                    )
                )
            )


class AdministratorRoleAssignment(AbstractRelationship):
    """Represents a user being assigned an administrative role in the application.

    It is exclusive because a user can only have one administrative role at a time.
    """

    exclusive = True

    def __init__(self, user_id: int | str, role: AdministratorRole):
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
    def user_id(self) -> int | str:
        return self._user_id

    @property
    def user_type(self) -> str:
        return "user"

    async def remove_tuples(self, openfga: OpenFgaApi, add_list: list) -> None:
        for request in add_list:
            relation_tuple = request.writes.tuple_keys[0]

            if (
                relation_tuple.object == f"{self.object_type}:{self.object_id}"
                and relation_tuple.user == f"{self.user_type}:{self.user_id}"
                and relation_tuple.relation in iter(AdministratorRole)
            ):
                add_list.remove(request)

        response = await openfga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"{self.user_type}:{self.user_id}",
                    object=f"{self.object_type}:{self.object_id}",
                ),
            )
        )

        if response.tuples:
            await openfga.write(
                WriteRequest(
                    deletes=TupleKeys(
                        [response_tuple.key for response_tuple in response.tuples]
                    )
                )
            )


class SpaceMembership(AbstractRelationship):
    exclusive = True

    """
    Represents a user being a member or and owner of a space.

    It is exclusive because a user can only be either a member or owner of one space at
    a time.

    """

    def __init__(self, user_id: int | str, space_id: int, role: SpaceRole):
        self._user_id = user_id
        self._role = role
        self._space_id = space_id

    @property
    def object_id(self) -> int | str:
        return self._space_id

    @property
    def object_type(self) -> str:
        return ResourceType.SPACE.value

    @property
    def relation(self) -> str:
        return self._role.value

    @property
    def user_id(self) -> int | str:
        return self._user_id

    @property
    def user_type(self) -> str:
        return "user"

    async def remove_tuples(self, openfga: OpenFgaApi, add_list: list) -> None:
        for request in add_list:
            relation_tuple = request.writes.tuple_keys[0]

            if (
                relation_tuple.object == f"{self.object_type}:{self.object_id}"
                and relation_tuple.user == f"{self.user_type}:{self.user_id}"
                and relation_tuple.relation in iter(SpaceRole)
            ):
                add_list.remove(request)

        member_response = await openfga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"{self.user_type}:{self.user_id}",
                    relation=SpaceRole.MEMBER,
                    object=f"{self.object_type}:{self.object_id}",
                ),
            )
        )

        owner_response = await openfga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"{self.user_type}:{self.user_id}",
                    relation=SpaceRole.OWNER,
                    object=f"{self.object_type}:{self.object_id}",
                ),
            )
        )

        if member_response.tuples or owner_response.tuples:
            await openfga.write(
                WriteRequest(
                    deletes=TupleKeys(
                        [
                            response_tuple.key
                            for response_tuple in member_response.tuples
                        ]
                        + [
                            response_tuple.key
                            for response_tuple in owner_response.tuples
                        ]
                    )
                )
            )


class SpaceRoleAssignment(AbstractRelationship):
    """Represents a space having the given base role."""

    def __init__(self, space_id: int, role: SpaceRoleType):
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
        return self._role.value

    @property
    def user_id(self) -> int | str:
        return f"{self._space_id}#member"

    @property
    def user_type(self) -> str:
        return "space"


class UserRoleAssignment(AbstractRelationship):
    """Represents a user having a given role in a space."""

    def __init__(self, user_id: str, space_id: int, role: SpaceRoleType):
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


class ReferenceRoleAssignment(AbstractRelationship):
    """Represents a user having a given role on a reference."""

    def __init__(self, ref_id: str, user_id: str, role: ReferenceRole):
        self._ref_id = ref_id
        self._user_id = user_id
        self._role = role

    @property
    def object_id(self) -> str:
        return self._ref_id

    @property
    def object_type(self) -> str:
        return ResourceType.REFERENCE.value

    @property
    def relation(self) -> str:
        return self._role.value

    @property
    def user_id(self) -> str:
        return self._user_id

    @property
    def user_type(self) -> str:
        return "user"
