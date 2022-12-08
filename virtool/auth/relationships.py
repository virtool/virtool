from virtool.api.response import NotFound
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.groups.oas import UpdateGroupRequest
from virtool.users.oas import UpdateUserRequest


class BaseRelationship:
    def __init__(self, relation):
        self.object_name = "virtool"
        self.object_type = "app"
        self.user_type = "user"
        self.relation = relation

    async def add(self, data):
        ...

    async def remove(self, data):
        ...


class GroupMembership(BaseRelationship):
    def __init__(self, user_id, group_id, relation):
        super().__init__(relation)
        self.user_id = user_id
        self.object_name = group_id
        self.object_type = "group"

    async def add(self, data: DataLayer):
        group_list = [self.object_name]

        data_dict = UpdateUserRequest(groups=group_list)

        await data.users.update(self.user_id, data_dict)


class GroupPermission(BaseRelationship):
    def __init__(self, group_id, relation):
        super().__init__(relation)
        self.user_id = group_id
        self.user_type = "group"

    async def add(self, data: DataLayer):
        permission_dict = {permission.name: True for permission in self.relation}

        data_dict = UpdateGroupRequest(permissions=permission_dict)

        try:
            await data.groups.update(self.user_id, data_dict)
        except ResourceNotFoundError:
            self.user_id = f"{self.user_id}#member"
            raise ResourceNotFoundError()

    async def remove(self, data):
        permission_dict = {permission.name: False for permission in self.relation}

        data_dict = UpdateGroupRequest(permissions=permission_dict)

        try:
            await data.groups.update(self.user_id, data_dict)
        except ResourceNotFoundError:
            self.user_id = f"{self.user_id}#member"
            raise ResourceNotFoundError()


class UserPermission(BaseRelationship):
    def __init__(self, user_id, relation):
        super().__init__(relation)
        self.user_id = user_id
