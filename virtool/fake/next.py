"""
Easily create fake data.

# Dependencies

A sample needs a user and upload to exist.
```py

```

"""
import pathlib
from typing import List, Optional

import aiofiles
from faker import Faker
from faker.providers import BaseProvider, python, color, lorem, file
from virtool_core.models.group import Group
from virtool_core.models.job import Job
from virtool_core.models.label import Label
from virtool_core.models.task import Task
from virtool_core.models.upload import Upload
from virtool_core.models.user import User

from virtool.data.layer import DataLayer
from virtool.groups.oas import UpdatePermissionsRequest, UpdateGroupRequest
from virtool.indexes.tasks import AddIndexFilesTask, AddIndexJSONTask
from virtool.jobs.utils import WORKFLOW_NAMES, JobRights
from virtool.references.tasks import (
    CloneReferenceTask,
    CleanReferencesTask,
    DeleteReferenceTask,
)
from virtool.subtractions.tasks import AddSubtractionFilesTask
from virtool.uploads.models import UploadType
from virtool.uploads.utils import CHUNK_SIZE, naive_writer
from virtool.users.oas import UpdateUserRequest


async def fake_file_chunks(path: pathlib.Path) -> bytearray:
    """
    Read a chunk of size `CHUNK_SIZE` from a file.
    """
    async with aiofiles.open(path, "r") as f:

        yield await f.read(CHUNK_SIZE)


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
    def __init__(self, layer: DataLayer):
        self.layer = layer

        self.faker = Faker()
        self.faker.seed_instance(0)
        self.faker.add_provider(VirtoolProvider)
        self.faker.add_provider(color)
        self.faker.add_provider(lorem)
        self.faker.add_provider(python)
        self.faker.add_provider(file)

        self.groups = GroupsFakerPiece(self)
        self.labels = LabelsFakerPiece(self)
        self.jobs = JobsFakerPiece(self)
        self.tasks = TasksFakerPiece(self)
        self.users = UsersFakerPiece(self)
        self.uploads = UploadsFakerPiece(self)


class DataFakerPiece:
    def __init__(self, data_faker: DataFaker):
        self.layer = data_faker.layer
        self.faker = data_faker.faker
        self.history = []


class JobsFakerPiece(DataFakerPiece):
    model = Job

    async def create(self, user: User) -> Job:
        return await self.layer.jobs.create(
            self.faker.workflow(),
            self.faker.pydict(nb_elements=6, value_types=[str, int, float]),
            user.id,
            JobRights(),
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
        return await self.layer.tasks.register(
            self.faker.random_element(
                [
                    AddIndexFilesTask,
                    AddIndexJSONTask,
                    AddSubtractionFilesTask,
                    CloneReferenceTask,
                    CleanReferencesTask,
                    DeleteReferenceTask,
                ]
            ),
            {},
        )


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
                    user.id, UpdateUserRequest(groups=[group.id for group in groups])
                )

            if primary_group:
                await self.layer.users.update(
                    user.id, UpdateUserRequest(primary_group=primary_group.id)
                )

            return await self.layer.users.get(user.id)

        return user


class UploadsFakerPiece(DataFakerPiece):
    model = Upload

    async def create(
        self,
        user: User,
        with_file: bool = False,
        upload_type: str = "reads",
        name: str = "test.fq.gz",
        reserved: bool = False,
    ) -> Upload:

        if upload_type not in UploadType.to_list():
            upload_type = "reads"

        upload = await self.layer.uploads.create(name, upload_type, reserved, user.id)

        size = self.faker.pyint(min_value=100)

        if with_file:
            config = getattr(self.layer.uploads, "_config")
            file_path = config.data_path / "files" / upload.name_on_disk
            size = await naive_writer(fake_file_chunks(file_path), file_path)

        upload = await self.layer.uploads.finalize(size, upload.id)

        return upload
