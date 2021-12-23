from abc import ABC, abstractmethod

import pytest
from attr import dataclass
from faker.proxy import Faker
from virtool.fake.wrapper import FakerWrapper


class AbstractFakeDataGenerator(ABC):
    @abstractmethod
    def create() -> dict:
        ...

    @abstractmethod
    async def insert() -> dict:
        ...

    @abstractmethod
    async def get_id() -> str:
        ...


class FakeJobGenerator(AbstractFakeDataGenerator):
    def __init__(self, fake_generator, db):
        self.generator = fake_generator

        self._db = db
        self._faker = Faker()

    async def create(self) -> dict:
        return {
            "acquired": self._faker.pybool(),
            "workflow": "nuvs",
            "args": {},
            "key": None,
            "rights": {},
            "state": "waiting",
            "status": [
                {
                    "state": "waiting",
                    "stage": None,
                    "error": None,
                    "progress": 0,
                    "timestamp": self._faker.date_time(),
                }
            ],
            "user": {"id": await self.generator.users.get_id()},
        }

    async def insert(self) -> dict:
        document = await self.create()
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

    async def create(self):
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

    async def insert(self):
        document = await self.create()
        await self._db.users.insert_one(document)
        return document

    async def get_id(self):
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
