import datetime
from abc import ABC, abstractmethod

import arrow
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.models.enums import Permission

from virtool.fake.next import DataFaker
from virtool.fake.wrapper import FakerWrapper
from virtool.subtractions.models import SubtractionFile
from virtool.types import Document
from virtool.uploads.models import Upload


class AbstractFakeDataGenerator(ABC):
    @abstractmethod
    async def insert(self) -> Document:
        ...

    @abstractmethod
    async def get_id(self) -> str:
        ...


class FakeJobGenerator(AbstractFakeDataGenerator):
    def __init__(self, fake_generator, db):
        self.generator = fake_generator

        self._db = db
        self._faker = FakerWrapper()

    async def create(self, randomize: bool = False) -> dict:
        if randomize:
            status = self._faker.fake.job_status()

            timestamp = arrow.get(
                self._faker.fake.date_time_between(
                    start_date=datetime.datetime(2016, 1, 1, 12, 32, 33)
                )
            ).naive

            end_timestamp = timestamp + datetime.timedelta(days=1.5)

            progress = 0

            for entry in status:
                entry.update({"timestamp": timestamp, "progress": progress})

                progress = self._faker.fake.random_int(min=progress, max=100)
                timestamp = arrow.get(
                    self._faker.fake.date_time_between(
                        start_date=timestamp, end_date=end_timestamp
                    )
                ).naive
        else:
            status = [
                {
                    "state": "waiting",
                    "stage": None,
                    "error": None,
                    "progress": 0,
                    "timestamp": self._faker.date_time(),
                }
            ]

        workflow = self._faker.fake.workflow() if randomize else "nuvs"
        archived = self._faker.fake.archive() if randomize else False

        return {
            "_id": self._faker.fake.mongo_id(),
            "acquired": False,
            "archived": archived,
            "workflow": workflow,
            "args": {},
            "key": None,
            "rights": {},
            "state": "waiting",
            "status": status,
            "user": {"id": await self.generator.users.get_id()},
        }

    async def insert(self, randomize: bool = False) -> dict:
        document = await self.create(randomize)
        await self._db.jobs.insert_one(document)
        return document

    async def get_id(self):
        id_list = await self._db.jobs.distinct("_id")

        if id_list:
            return self._faker.random_element(id_list)

        document = await self.insert()

        return document["_id"]


class FakeSubtractionGenerator(AbstractFakeDataGenerator):
    def __init__(self, fake_generator, db, pg):
        self.generator = fake_generator
        self._db = db
        self._pg = pg
        self._faker = FakerWrapper()

    async def get_id(self) -> str:
        id_list = await self._db.users.distinct("_id")

        if id_list:
            return self._faker.random_element(id_list)

        return (await self.insert())["_id"]

    async def insert(self) -> Document:
        subtraction_id = self._faker.get_mongo_id()

        user = await self.generator.users.insert()

        async with AsyncSession(self._pg) as session:
            upload = Upload(
                id=1,
                created_at=self._faker.fake.date_time_between(
                    datetime.datetime(2015, 10, 6), datetime.datetime(2050, 1, 1)
                ),
                name="palm.fa.gz",
                name_on_disk="1-palm.fa.gz",
                ready=True,
                removed=False,
                reserved=False,
                size=12345,
                type="subtraction",
                user=user["_id"],
                uploaded_at=self._faker.fake.date_time_between(
                    datetime.datetime(2015, 10, 6), datetime.datetime(2050, 1, 1)
                ),
            )

            session.add_all(
                [
                    upload,
                    SubtractionFile(
                        name="subtraction.fq.gz",
                        subtraction=subtraction_id,
                        type="fasta",
                        size=12345,
                    ),
                    SubtractionFile(
                        name="subtraction.1.bt2",
                        subtraction=subtraction_id,
                        type="bowtie2",
                        size=56437,
                    ),
                    SubtractionFile(
                        name="subtraction.2.bt2",
                        subtraction=subtraction_id,
                        type="bowtie2",
                        size=93845,
                    ),
                ]
            )

            await session.commit()

        finalization_update = self._faker.random_element(
            [
                {
                    "gc": {
                        letter: self._faker.fake.pyfloat(min_value=0, max_value=1.0)
                        for letter in "atgcn"
                    },
                    "ready": True,
                    "count": self._faker.integer(max_value=36),
                },
                {"ready": False},
            ]
        )

        document = {
            "_id": subtraction_id,
            "has_file": True,
            "file": {"id": 1, "name": "fake.fa.gz"},
            "name": self._faker.fake.word(),
            "nickname": self._faker.fake.word(),
            "deleted": self._faker.boolean(),
            "ready": self._faker.boolean(),
            "upload": 1,
            "user": {"id": user["_id"]},
            "created_at": self._faker.fake.date_time_between(
                datetime.datetime(2015, 10, 6), datetime.datetime(2050, 1, 1)
            ),
            **finalization_update,
        }

        await self._db.subtraction.insert_one(document)

        return document


class FakeUserGenerator(AbstractFakeDataGenerator):
    def __init__(self, fake_generator, db):
        self.generator = fake_generator

        self._db = db
        self._faker = FakerWrapper()

    async def create(self) -> Document:
        profile = self._faker.profile()

        return {
            "_id": self._faker.get_mongo_id(),
            "groups": ["technicians", "bosses"],
            "handle": profile["username"],
            "primary_group": "technicians",
            "username": profile["username"],
            "permissions": {p.value: False for p in Permission},
            "administrator": False,
            "created_at": self._faker.date_time(),
        }

    async def insert(self) -> Document:
        document = await self.create()
        await self._db.users.insert_one(document)
        return document

    async def get_id(self) -> str:
        id_list = await self._db.users.distinct("_id")

        if id_list:
            return self._faker.random_element(id_list)

        document = await self.insert()

        return document["_id"]


class FakeGenerator:
    def __init__(self, mongo, pg):
        self.jobs = FakeJobGenerator(self, mongo)
        self.users = FakeUserGenerator(self, mongo)
        self.subtractions = FakeSubtractionGenerator(self, mongo, pg)


@pytest.fixture
def app(mongo, pg, tmp_path, config, data_layer):
    return {
        "db": mongo,
        "fake": FakerWrapper(),
        "pg": pg,
        "config": config,
        "data": data_layer
    }


@pytest.fixture
def fake(mongo, pg):
    return FakeGenerator(mongo, pg)


@pytest.fixture
def fake2(data_layer):
    return DataFaker(data_layer)
