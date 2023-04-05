"""
Authorization clients.

"""
import asyncio
from typing import Union, List, Tuple, Optional

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
from virtool_core.models.roles import (
    AdministratorRole,
    ReferenceRole,
    SpaceRoleType,
)

from virtool.authorization.permissions import (
    ResourceType,
    ReferencePermission,
)
from virtool.authorization.relationships import AbstractRelationship
from virtool.authorization.results import (
    RemoveRelationshipResult,
    AddRelationshipResult,
)


class AuthorizationClient:
    """
    An authorization client backed by OpenFGA.

    """

    def __init__(self, open_fga: OpenFgaApi):
        self.open_fga = open_fga

    async def check(
        self,
        user_id: str,
        permission: Union[Permission, ReferencePermission, AdministratorRole],
        resource_type: ResourceType,
        resource_id: Union[str, int],
    ) -> bool:
        """
        Check whether a user has the given role on a resource.
        """

        response = await self.open_fga.check(
            CheckRequest(
                tuple_key=TupleKey(
                    user=f"user:{user_id}",
                    relation=permission.value,
                    object=f"{resource_type.value}:{resource_id}",
                ),
            )
        )

        return response.allowed

    async def get_space_roles(self, space_id: int) -> List[str]:
        """
        Return a list of base roles for a space.

        :param space_id: the id of the space
        :return: a list of roles
        """
        response = await self.open_fga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"space:{space_id}#member", object=f"space:{space_id}"
                )
            )
        )

        return sorted(
            [relation_tuple.key.relation for relation_tuple in response.tuples]
        )

    async def get_administrator(
        self, user_id: str
    ) -> Tuple[str, Optional[AdministratorRole]]:
        response = await self.open_fga.read(
            ReadRequest(
                tuple_key=TupleKey(user=f"user:{user_id}", object="app:virtool"),
            )
        )

        role = None
        if response.tuples:
            role = AdministratorRole(response.tuples[0].key.relation)
            user_id = response.tuples[0].key.user.split(":")[1]

        return user_id, role

    async def list_administrators(self) -> List[Tuple[str, AdministratorRole]]:
        """
        Return a list of user ids that are administrators and their roles.

        :return: a list of tuples containing user ids and their roles

        """
        response = await self.open_fga.read(
            ReadRequest(
                tuple_key=TupleKey(object="app:virtool"),
            )
        )

        return sorted(
            [
                (relation_tuple.key.user.split(":")[1], relation_tuple.key.relation)
                for relation_tuple in response.tuples
            ]
        )

    async def list_user_spaces(self, user_id: str) -> List[int]:
        """
        Return a list of ids of spaces the user is a member of.

        :param user_id: the id of the user
        :return: a list of space ids
        """
        response = await self.open_fga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"user:{user_id}", relation="member", object="space:"
                ),
            )
        )

        return sorted(
            [
                int(relation_tuple.key.object.split(":")[1])
                for relation_tuple in response.tuples
            ]
        )

    async def list_user_roles(self, user_id: str, space_id: int) -> List[SpaceRoleType]:
        response = await self.open_fga.read(
            ReadRequest(
                tuple_key=TupleKey(user=f"user:{user_id}", object=f"space:{space_id}")
            )
        )

        return sorted(
            [relation_tuple.key.relation for relation_tuple in response.tuples]
        )

    async def list_reference_users(
        self, ref_id: str
    ) -> List[Tuple[str, ReferenceRole]]:
        """
        List users and their roles on a reference.

        The returned list only includes users that have an explicit role defined on the
        reference. Space members that have access to the reference through the space
        base role are not included.

        :param ref_id: the id of the reference
        :return: a list of user ids and their roles
        """
        response = await self.open_fga.read(
            ReadRequest(
                tuple_key=TupleKey(object=f"reference:{ref_id}"),
            )
        )

        return sorted(
            [
                (relation_tuple.key.user.split(":")[1], relation_tuple.key.relation)
                for relation_tuple in response.tuples
            ]
        )

    async def add(self, *relationships: AbstractRelationship):
        """
        Add one or more authorization relationships.

        :param relationships:
        """

        requests = []

        for relationship in relationships:
            if relationship.exclusive:
                await relationship.remove_tuples(self.open_fga, requests)

            requests.append(
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
            )

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
