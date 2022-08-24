"""
Easily create fake data.

# Dependencies

A sample needs a user and upload to exist.
```py

```

"""
from typing import List, Optional, Dict, Any

from faker import Faker
from faker.providers import BaseProvider, python
from virtool_core.models.group import Group
from virtool_core.models.job import Job
from virtool_core.models.user import User

from virtool.data.layer import DataLayer
from virtool.groups.oas import EditPermissionsSchema, EditGroupSchema
from virtool.jobs.utils import WORKFLOW_NAMES, JobRights
from virtool.users.oas import UpdateUserSchema


class VirtoolProvider(BaseProvider):
    def mongo_id(self):
        return self.random_letters(8)

    def pg_id(self) -> int:
        return self.random_int()

    def workflow(self) -> str:
        return self.random_choices(WORKFLOW_NAMES, 1)[0]


class DataFaker:
    def __init__(self, layer: DataLayer):
        self.layer = layer

        self.faker = Faker()
        self.faker.seed_instance(0)
        self.faker.add_provider(VirtoolProvider)
        self.faker.add_provider(python)

        self.groups = GroupsFakerPiece(self)
        self.jobs = JobsFakerPiece(self)
        self.users = UsersFakerPiece(self)


class DataFakerPiece:
    def __init__(self, data_faker: DataFaker):
        self.layer = data_faker.layer
        self.faker = data_faker.faker
        self.history = []


class JobsFakerPiece(DataFakerPiece):
    model = Job

    async def create(self, user: User) -> Job:
        document = await self.layer.jobs.create(
            self.faker.workflow(),
            self.faker.pydict(nb_elements=6, value_types=[str, int, float]),
            user.id,
            JobRights(),
        )

        document = await self.layer.jobs.get(document["_id"])

        return Job(**document)


class GroupsFakerPiece(DataFakerPiece):
    model = Group

    async def create(self, permissions: Optional[EditPermissionsSchema] = None):
        group_id = "contains spaces"

        while " " in group_id:
            group_id = self.faker.profile()["job"].lower() + "s"

        group = await self.layer.groups.create(group_id)

        if permissions:
            group = await self.layer.groups.update(
                group.id, EditGroupSchema(permissions=permissions)
            )

        return group


class UsersFakerPiece(DataFakerPiece):
    model = User

    async def create(
        self,
        groups: Optional[List[Group]] = None,
        primary_group: Optional[Group] = None,
    ):
        user = await self.layer.users.create(
            self.faker.profile()["username"], self.faker.password()
        )

        if groups or primary_group:
            if groups:
                await self.layer.users.update(
                    user.id, UpdateUserSchema(groups=[group.id for group in groups])
                )

            if primary_group:
                await self.layer.users.update(
                    user.id, UpdateUserSchema(primary_group=primary_group.id)
                )

            return await self.layer.users.get(user.id)

        return user
