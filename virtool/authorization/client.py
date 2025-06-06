"""The client class and utilities for managing authorization."""

import asyncio

from aiohttp.web_request import Request
from openfga_sdk import (
    ApiException,
    CheckRequest,
    OpenFgaApi,
    ReadRequest,
    TupleKey,
    TupleKeys,
    WriteRequest,
)

from virtool.authorization.permissions import (
    Permission,
    ReferencePermission,
    ResourceType,
)
from virtool.authorization.relationships import AbstractRelationship
from virtool.authorization.results import (
    AddRelationshipResult,
    RemoveRelationshipResult,
)
from virtool.models.roles import (
    AdministratorRole,
    ReferenceRole,
    SpaceRole,
    SpaceRoleType,
)
from virtool.types import App


class AuthorizationClient:
    """The Virtool authorization client.

    The client is currently backed by OpenFGA, but is built to abstract away the
    underlying authorization service.

    """

    def __init__(self, openfga: OpenFgaApi):
        #: The backing OpenFGA API instance.
        self.openfga = openfga

    async def close(self):
        """Close the authorization client."""
        await self.openfga.close()

    async def check(
        self,
        user_id: str,
        permission: Permission | ReferencePermission | AdministratorRole,
        resource_type: ResourceType,
        resource_id: str | int,
    ) -> bool:
        """Check whether a user has the given role on a resource."""
        response = await self.openfga.check(
            CheckRequest(
                tuple_key=TupleKey(
                    user=f"user:{user_id}",
                    relation=permission.value,
                    object=f"{resource_type.value}:{resource_id}",
                ),
            )
        )

        return response.allowed

    async def get_space_roles(self, space_id: int) -> list[str]:
        """Return a list of base roles for a space.

        :param space_id: the id of the space
        :return: a list of roles
        """
        response = await self.openfga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"space:{space_id}#member", object=f"space:{space_id}"
                )
            )
        )

        return sorted([relation.key.relation for relation in response.tuples])

    async def get_administrator(
        self, user_id: str
    ) -> tuple[str, AdministratorRole | None]:
        response = await self.openfga.read(
            ReadRequest(
                tuple_key=TupleKey(user=f"user:{user_id}", object="app:virtool"),
            )
        )

        role = None
        if response.tuples:
            role = AdministratorRole(response.tuples[0].key.relation)
            user_id = response.tuples[0].key.user.split(":")[1]

        return user_id, role

    async def list_administrators(self) -> list[tuple[str, AdministratorRole]]:
        """Return a list of user ids that are administrators and their roles.

        :return: a list of tuples containing user ids and their roles

        """
        response = await self.openfga.read(
            ReadRequest(
                tuple_key=TupleKey(object="app:virtool"),
            )
        )

        return sorted(
            [
                (relation.key.user.split(":")[1], relation.key.relation)
                for relation in response.tuples
            ]
        )

    async def list_user_spaces(self, user_id: str) -> list[int]:
        """Return a list of ids of spaces the user is a member of.

        :param user_id: the id of the user
        :return: a list of space ids
        """
        response = await self.openfga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"user:{user_id}", relation="member", object="space:"
                ),
            )
        )

        test = [int(relation.key.object.split(":")[1]) for relation in response.tuples]

        response = await self.openfga.read(
            ReadRequest(
                tuple_key=TupleKey(
                    user=f"user:{user_id}", relation="owner", object="space:"
                ),
            )
        )

        test2 = [int(relation.key.object.split(":")[1]) for relation in response.tuples]

        return sorted([*test, *test2])

    async def list_user_roles(self, user_id: str, space_id: int) -> list[SpaceRoleType]:
        response = await self.openfga.read(
            ReadRequest(
                tuple_key=TupleKey(user=f"user:{user_id}", object=f"space:{space_id}")
            )
        )

        return sorted([relation.key.relation for relation in response.tuples])

    async def list_reference_users(
        self, ref_id: str
    ) -> list[tuple[str, ReferenceRole]]:
        """List users and their roles on a reference.

        The returned list only includes users that have an explicit role defined on the
        reference. Space members that have access to the reference through the space
        base role are not included.

        :param ref_id: the id of the reference
        :return: a list of user ids and their roles
        """
        response = await self.openfga.read(
            ReadRequest(
                tuple_key=TupleKey(object=f"reference:{ref_id}"),
            )
        )

        return sorted(
            [
                (relation.key.user.split(":")[1], relation.key.relation)
                for relation in response.tuples
            ]
        )

    async def list_space_users(
        self, space_id: int
    ) -> list[tuple[str, list[SpaceRole]]]:
        """List members of a space"""
        response = await self.openfga.read(
            ReadRequest(
                tuple_key=TupleKey(object=f"space:{space_id}"),
            )
        )

        relations = {}

        for relation in response.tuples:
            user_id = relation.key.user.split(":")[1]

            if user_id not in relations:
                relations[user_id] = [relation.key.relation]

            else:
                relations[user_id].append(relation.key.relation)

        relations = list(relations.items())

        return sorted(
            [
                relation
                for relation in relations
                if "member" in relation[1] or "owner" in relation[1]
            ]
        )

    async def add(self, *relationships: AbstractRelationship):
        """Add one or more authorization relationships.

        :param relationships:
        """
        requests = []

        for relationship in relationships:
            if relationship.exclusive:
                await relationship.remove_tuples(self.openfga, requests)

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
            [asyncio.create_task(self.openfga.write(request)) for request in requests]
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
        """Remove one or more authorization relationships."""
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
            [asyncio.create_task(self.openfga.write(request)) for request in requests]
        )

        result = RemoveRelationshipResult(0, 0)

        for aw in done:
            try:
                await aw
            except ApiException:
                result.not_found_count += 1

        result.removed_count = len(relationships) - result.not_found_count

        return result


def get_authorization_client_from_app(app: App) -> "AuthorizationClient":
    """Get the authorization client instance from an :class:`virtool.types.App` object.

    Use this when you need to access the authorization client outside a request handler.

    :param app: the application object
    """
    return app["authorization"]


def get_authorization_client_from_req(req: Request) -> "AuthorizationClient":
    """Get the authorization client instance from a :class:``aiohttp.web.Request`` object.

    Use this in request handlers instead of ``get_authorization_client_from_app``.

    :param req: the request
    """
    return get_authorization_client_from_app(req.app)
