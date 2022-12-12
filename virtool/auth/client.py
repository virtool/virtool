import asyncio
from abc import ABC, abstractmethod
from typing import Union

from openfga_sdk import TupleKey, OpenFgaApi
from virtool_core.models.enums import Permission

from virtool.auth.mongo import (
    check_in_mongo,
    list_permissions_in_mongo,
)
from virtool.auth.openfga import (
    check_in_open_fga,
    list_permissions_in_open_fga,
    add_in_open_fga,
    remove_in_open_fga,
)
from virtool.auth.relationships import BaseRelationship
from virtool.data.errors import ResourceNotFoundError

from virtool.mongo.core import DB


class AbstractAuthorizationClient(ABC):
    @abstractmethod
    async def check(
        self,
        user_id: str,
        permission: Permission,
        object_type: str,
        object_id: Union[str, int],
    ) -> bool:
        ...

    @abstractmethod
    async def list_permissions(
        self, user_id: str, object_type: str, object_id: Union[str, int]
    ) -> dict:
        ...

    @abstractmethod
    async def add(self, relationship: BaseRelationship):
        ...

    @abstractmethod
    async def remove(self, relationship: BaseRelationship):
        ...


class AuthorizationClient(AbstractAuthorizationClient):
    def __init__(self, mongo: DB, open_fga: OpenFgaApi):
        self.mongo = mongo
        self.open_fga = open_fga

    async def check(
        self,
        user_id: str,
        permission: Permission,
        object_type: str,
        object_id: Union[str, int],
    ) -> bool:
        """
        Check whether a user has a permission on a resource.
        """

        mongo_result, open_fga_result = await asyncio.gather(
            *[
                check_in_mongo(self.mongo, user_id, permission),
                check_in_open_fga(
                    self.open_fga, user_id, permission, object_type, object_id
                ),
            ]
        )

        return mongo_result or open_fga_result

    async def list_permissions(
        self, user_id: str, object_type: str, object_id: Union[str, int]
    ) -> dict:
        """
        List permissions for a user.
        """
        try:
            return await list_permissions_in_mongo(self.mongo, user_id)
        except ResourceNotFoundError:
            return await list_permissions_in_open_fga(
                self.open_fga, user_id, object_type, object_id
            )

    async def add(self, relationship: BaseRelationship):
        """
        Add an authorization relationship.
        """
        try:
            await relationship.add(self.mongo)
        except ResourceNotFoundError:
            pass

        tuple_list = [
            TupleKey(
                user=f"{relationship.user_type}:{relationship.user_id}",
                relation=relation,
                object=f"{relationship.object_type}:{relationship.object_name}",
            )
            for relation in relationship.relation
        ]

        await add_in_open_fga(self.open_fga, tuple_list)

    async def remove(self, relationship: BaseRelationship):
        """
        Remove an authorization relationship.
        """
        try:
            await relationship.remove(self.mongo)
        except ResourceNotFoundError:
            pass

        tuple_list = [
            TupleKey(
                user=f"{relationship.user_type}:{relationship.user_id}",
                relation=relation,
                object=f"{relationship.object_type}:{relationship.object_name}",
            )
            for relation in relationship.relation
        ]

        await remove_in_open_fga(self.open_fga, tuple_list)
