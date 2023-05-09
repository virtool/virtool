"""
Easily create fake data.

# Dependencies

A sample needs a user and upload to exist.
```py

```

"""
from typing import Dict, List, Optional, Type

from faker import Faker
from faker.providers import BaseProvider, color, lorem, python
from virtool_core.models.group import Group
from virtool_core.models.job import Job
from virtool_core.models.label import Label
from virtool_core.models.task import Task
from virtool_core.models.user import User
from virtool_core.models.hmm import HMM

from virtool.administrators.oas import UpdateUserRequest
from virtool.data.layer import DataLayer
from virtool.groups.oas import UpdateGroupRequest, UpdatePermissionsRequest
from virtool.indexes.tasks import EnsureIndexFilesTask
from virtool.jobs.utils import WORKFLOW_NAMES, JobRights
from virtool.references.tasks import CleanReferencesTask, CloneReferenceTask
from virtool.subtractions.tasks import AddSubtractionFilesTask
from virtool.tasks.task import BaseTask


class VirtoolProvider(BaseProvider):
    def mongo_id(self):
        return self.random_letters(8)

    def pg_id(self) -> int:
        return self.random_int()

    def workflow(self) -> str:
        return self.random_choices(
            [name.replace("job_", "") for name in WORKFLOW_NAMES], 1
        )[0]


class DataFaker:
    def __init__(self, layer: DataLayer, mongo):
        self.layer = layer

        self.faker = Faker()
        self.faker.seed_instance(0)
        self.faker.add_provider(VirtoolProvider)
        self.faker.add_provider(color)
        self.faker.add_provider(lorem)
        self.faker.add_provider(python)

        self.groups = GroupsFakerPiece(self)
        self.labels = LabelsFakerPiece(self)
        self.jobs = JobsFakerPiece(self)
        self.tasks = TasksFakerPiece(self)
        self.users = UsersFakerPiece(self)
        self.hmm = HMMFakerPiece(self)

        self.mongo = mongo


class DataFakerPiece:
    def __init__(self, data_faker: DataFaker):
        self.layer = data_faker.layer
        self.faker = data_faker.faker
        self.history = []


class JobsFakerPiece(DataFakerPiece):
    model = Job

    async def create(self, user: User, workflow: Optional[str] = None) -> Job:
        return await self.layer.jobs.create(
            workflow or self.faker.workflow(),
            self.faker.pydict(nb_elements=6, value_types=[str, int, float]),
            user.id,
            JobRights(),
            0,
        )


class GroupsFakerPiece(DataFakerPiece):
    model = Group

    async def create(self, permissions: Optional[UpdatePermissionsRequest] = None):
        group_id = "contains spaces"

        while " " in group_id:
            group_id = self.faker.profile()["job"].lower() + "s"

        group = await self.layer.groups.create(group_id)

        if permissions:
            group = await self.layer.groups.update(
                group.id, UpdateGroupRequest(permissions=permissions)
            )

        return group


class LabelsFakerPiece(DataFakerPiece):
    model = Label

    async def create(self):
        return await self.layer.labels.create(
            self.faker.word().capitalize(),
            self.faker.hex_color(),
            self.faker.sentence(),
        )


class TasksFakerPiece(DataFakerPiece):
    model = Task

    async def create(self):
        return await self.layer.tasks.create(
            self.faker.random_element(
                [
                    EnsureIndexFilesTask,
                    AddSubtractionFilesTask,
                    CloneReferenceTask,
                    CleanReferencesTask,
                ]
            ),
            {},
        )

    async def create_with_class(self, cls: Type[BaseTask], context: Dict):
        return await self.layer.tasks.create(cls, context)


class UsersFakerPiece(DataFakerPiece):
    model = User

    async def create(
        self,
        handle: Optional[str] = None,
        groups: Optional[List[Group]] = None,
        primary_group: Optional[Group] = None,
    ):
        handle = handle or self.faker.profile()["username"]
        user = await self.layer.users.create(handle, self.faker.password())

        if groups or primary_group:
            if groups:
                await self.layer.administrators.update(
                    user.id, UpdateUserRequest(groups=[group.id for group in groups])
                )

            if primary_group:
                await self.layer.administrators.update(
                    user.id, UpdateUserRequest(primary_group=primary_group.id)
                )

            return await self.layer.users.get(user.id)

        return user


class HMMFakerPiece(DataFakerPiece):
    model = HMM

    async def create(self, mongo):

        hmm_id = "".join(self.faker.mongo_id())
        faker = self.faker

        document = await mongo.hmm.insert_one(
            {
                "entries": [
                    {
                        "accession": faker.pystr(),
                        "gi": faker.pystr(),
                        "name": faker.pystr(),
                        "organism": faker.pystr()
                    }
                ],
                "genera": {faker.pystr(): faker.pyint()},
                "length": faker.pyint(),
                "mean_entropy": faker.pyfloat(),
                "total_entropy": faker.pyfloat(),
                "_id": hmm_id,
                "cluster": faker.pyint(),
                "count": faker.pyint(),
                "families": {faker.pystr(): faker.pyint()},
                "names": [faker.pystr()]
            }
        )

        return HMM(**document)
