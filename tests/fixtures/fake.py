import datetime
from abc import ABC, abstractmethod

import pytest
import arrow

from virtool.fake.wrapper import FakerWrapper
from virtool.types import Document


class AbstractFakeDataGenerator(ABC):
    @abstractmethod
    def create(self) -> Document:
        ...

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
            "permissions": [],
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
    def __init__(self, db):
        self.jobs = FakeJobGenerator(self, db)
        self.users = FakeUserGenerator(self, db)


@pytest.fixture
def app(dbi, pg, tmp_path, config, settings):
    return {
        "db": dbi,
        "fake": FakerWrapper(),
        "pg": pg,
        "settings": settings,
        "config": config,
    }


@pytest.fixture
def fake(dbi):
    return FakeGenerator(dbi)
