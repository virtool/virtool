import asyncio
import itertools
from abc import ABC, abstractmethod
from typing import Union, List

from openfga_sdk import (
    OpenFgaApi,
    WriteRequest,
    TupleKeys,
    TupleKey,
    ApiException,
    ReadRequest,
    CheckRequest,
)
from virtool_core.models.enums import Permission

from virtool.authorization.permissions import PermissionType, ResourceType, SpacePermission
from virtool.authorization.relationships import AbstractRelationship, GroupPermission
from virtool.authorization.results import (
    RemoveRelationshipResult,
    AddRelationshipResult,
)


class AbstractAuthorizationClient(ABC):
    @abstractmethod
    async def check(
        self,
        user_id: str,
        permission: Permission,
        resource_type: ResourceType,
        resource_id: Union[str, int],
    ) -> bool:
        ...

    @abstractmethod
    async def list_groups(self, user_id: str) -> List[str]:
        ...

    @abstractmethod
    async def list_permissions(
        self, user_id: str, resource_type: ResourceType, resource_id: Union[str, int]
    ) -> dict:
        ...

    @abstractmethod
    async def add(self, *relationships: AbstractRelationship):
        ...

    @abstractmethod
    async def remove(self, *relationships: AbstractRelationship):
        ...


class AuthorizationClient(AbstractAuthorizationClient):
    """
    An authorization client backed by OpenFGA.

    """

    def __init__(self, open_fga: OpenFgaApi):
        self.open_fga = open_fga

    async def check(
        self,
        user_id: str,
        permission: PermissionType,
        resource_type: ResourceType,
        resource_id: Union[str, int],
    ) -> bool:
        """
        Check whether a user has a permission on a resource.
        """

        response = await self.open_fga.check(
            CheckRequest(
                tuple_key=TupleKey(
                    user=f"user:{user_id}",
                    relation=permission.value.id,
                    object=f"{resource_type.value}:{resource_id}",
                ),
            )
        )

        return response.allowed

    async def list_groups(self, user_id: str) -> List[str]:
        """
        Return a list of group IDs the user is a member of in OpenFGA.
        """
        response = await self.open_fga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"user:{user_id}", relation="member", object="group:"
                ),
            )
        )

        return sorted(
            [
                relation_tuple.key.object.split(":")[1]
                for relation_tuple in response.tuples
            ]
        )

    async def list_group_permissions(
        self, group_id: str, resource_type: ResourceType, resource_id: Union[str, int]
    ) -> List[PermissionType]:
        """
        List the permissions a group has.
        """
        raise_exception_if_not_default_space(resource_type, resource_id)

        response = await self.open_fga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"group:{group_id}#member",
                    object=f"{resource_type.value}:{resource_id}",
                ),
            )
        )

        return sorted([relation_tuple.key.relation for relation_tuple in response.tuples])

    async def list_permissions(
        self, user_id: str, resource_type: ResourceType, resource_id: Union[str, int]
    ) -> List[PermissionType]:
        """
        List permissions for a user.
        """
        raise_exception_if_not_default_space(resource_type, resource_id)

        group_ids = await self.list_groups(user_id)

        result = await asyncio.gather(
            *[
                self.list_group_permissions(group_id, resource_type, resource_id)
                for group_id in group_ids
            ]
        )

        permissions = list(itertools.chain(*result))

        response = await self.open_fga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"user:{user_id}",
                    object=f"{resource_type.value}:{resource_id}",
                )
            )
        )

        for relation_tuple in response.tuples:
            permissions.append(relation_tuple.key.relation)

        return sorted(permissions)

    async def add(self, *relationships: AbstractRelationship):

        """
        Add one or more authorization relationships.

        :param relationships:
        """
        requests = [
            WriteRequest(
                writes=TupleKeys(
                    tuple_keys=[
                        TupleKey(
                            user=f"{relationship.user_type}:{relationship.user_id}",
                            relation=relationship.relation,
                            object=f"{relationship.object_type}:{relationship.object_id}",
                        )
                    ]
                )
            )
            for relationship in relationships
        ]

        done, _ = await asyncio.wait(
            [self.open_fga.write(request) for request in requests]
        )

        result = AddRelationshipResult(0, 0)

        for aw in done:
            try:
                await aw
            except ApiException:
                result.exists_count += 1

        result.removed_count = len(relationships) - result.exists_count

        return result

    async def remove(self, *relationships: AbstractRelationship):
        """
        Remove one or more authorization relationships.
        """
        requests = [
            WriteRequest(
                deletes=TupleKeys(
                    tuple_keys=[
                        TupleKey(
                            user=f"{relationship.user_type}:{relationship.user_id}",
                            relation=relationship.relation,
                            object=f"{relationship.object_type}:{relationship.object_id}",
                        )
                    ]
                )
            )
            for relationship in relationships
        ]

        done, _ = await asyncio.wait(
            [self.open_fga.write(request) for request in requests]
        )

        result = RemoveRelationshipResult(0, 0)

        for aw in done:
            try:
                await aw
            except ApiException:
                result.not_found_count += 1

        result.removed_count = len(relationships) - result.not_found_count

        return result

    async def delete_group(self, group_id):
        permissions = await self.list_group_permissions(group_id, ResourceType.SPACE, 0)

        for permission in permissions:
            await self.remove(GroupPermission(group_id, SpacePermission.from_string(permission)))


def raise_exception_if_not_default_space(
    resource_type: ResourceType, resource_id: Union[int, str]
):
    """
    Raise an exception if the described resource is not the default space (id=0).

    This will be removed once more resource types are supported.
    """
    if resource_type != ResourceType.SPACE or resource_id != 0:
        raise ValueError(
            "Only permissions on the default space are currently supported"
        )
