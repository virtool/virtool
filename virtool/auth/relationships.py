from typing import List

from virtool_core.models.enums import Permission

from virtool.data.errors import ResourceNotFoundError
from virtool.errors import DatabaseError
from virtool.groups.db import update_member_users
from virtool.mongo.core import DB
from virtool.mongo.utils import get_one_field, id_exists
from virtool.users.db import compose_groups_update


class BaseRelationship:
    def __init__(self, relation):
        self.object_name = "virtool"
        self.object_type = "app"
        self.user_type = "user"
        self.relation = relation

    async def add(self, mongo: DB):
        ...

    async def remove(self, mongo: DB):
        ...


class GroupMembership(BaseRelationship):
    def __init__(self, user_id, group_id, relation):
        super().__init__(relation)
        self.user_id = user_id
        self.object_name = group_id
        self.object_type = "group"

    async def add(self, mongo: DB):
        groups = await get_one_field(mongo.users, "groups", {"_id": self.user_id}) or []

        try:
            update = await compose_groups_update(mongo, [self.object_name, *groups])
        except DatabaseError as err:
            raise ResourceNotFoundError(str(err))

        await mongo.users.update_one(
            {"_id": self.user_id}, {"$set": update}
        )

    async def remove(self, mongo: DB):
        groups = await get_one_field(mongo.users, "groups", {"_id": self.user_id}) or []

        if self.object_name not in groups:
            raise ResourceNotFoundError

        groups.remove(self.object_name)

        try:
            update = await compose_groups_update(mongo, groups)
        except DatabaseError as err:
            raise ResourceNotFoundError(str(err))

        await mongo.users.update_one(
            {"_id": self.user_id}, {"$set": update}
        )


class GroupPermission(BaseRelationship):
    def __init__(self, group_id, relation: List[Permission]):
        super().__init__(relation)
        self.user_id = group_id
        self.user_type = "group"

    async def add(self, mongo: DB):

        if not await id_exists(mongo.groups, self.user_id):
            self.user_id = f"{self.user_id}#member"
            raise ResourceNotFoundError

        update = {"permissions": {}}

        permission_dict = {permission.name: True for permission in self.relation}

        permissions = await get_one_field(
            mongo.groups, "permissions", {"_id": self.user_id}
        )

        update["permissions"] = {
            **permissions,
            **permission_dict,
        }

        async with mongo.create_session() as session:
            await mongo.groups.update_one(
                    {"_id": self.user_id},
                    {"$set": update},
                    session=session,
                )

            await update_member_users(mongo, self.user_id, session=session)

    async def remove(self, mongo: DB):

        if not await id_exists(mongo.groups, self.user_id):
            self.user_id = f"{self.user_id}#member"
            raise ResourceNotFoundError

        update = {"permissions": {}}

        permission_dict = {permission.name: False for permission in self.relation}

        permissions = await get_one_field(
            mongo.groups, "permissions", {"_id": self.user_id}
        )

        update["permissions"] = {
            **permissions,
            **permission_dict,
        }

        async with mongo.create_session() as session:
            await mongo.groups.update_one(
                    {"_id": self.user_id},
                    {"$set": update},
                    session=session,
                )

            await update_member_users(mongo, self.user_id, session=session)


class UserPermission(BaseRelationship):
    def __init__(self, user_id, relation):
        super().__init__(relation)
        self.user_id = user_id