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
from virtool.models.roles import AdministratorRole
from virtool.types import App


class AuthorizationClient:
    """The Virtool authorization client.

    The client is currently backed by OpenFGA, but is built to abstract away the
    underlying authorization service.

    """

    def __init__(self, openfga: OpenFgaApi):
        #: The backing OpenFGA API instance.
        self.openfga = openfga

    async def close(self) -> None:
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
                (
                    relation.key.user.split(":")[1],
                    AdministratorRole(relation.key.relation),
                )
                for relation in response.tuples
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
    """Get the authorization client instance from a :class:``aiohttp.web.Request``.

    Use this in request handlers instead of ``get_authorization_client_from_app``.

    :param req: the request
    """
    return get_authorization_client_from_app(req.app)
