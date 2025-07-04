from collections.abc import MutableMapping

import pytest

from tests.fixtures.core import StaticTime
from virtool.mongo.core import Mongo


class TestJob(MutableMapping):
    def __init__(self, db, data: dict):
        self._data = data
        self._db = db

    @property
    def id(self):
        return self._data["_id"]

    async def fetch(self):
        return self._db.jobs.find_one({"_id": self.id})

    def __getitem__(self, key):
        return self._data[key]

    def __setitem__(self, key, value):
        self._data[key] = value

    def __delitem__(self, key):
        del self._data[key]

    def __iter__(self):
        return iter(self._data)

    def __len__(self):
        return len(self._data)

    def __repr__(self):
        return repr(self._data)


@pytest.fixture()
def test_job(mongo: Mongo, static_time: StaticTime):
    return TestJob(
        mongo,
        {
            "_id": "4c530449",
            "acquired": False,
            "archived": False,
            "args": {
                "name": None,
                "username": "igboyes",
                "sample_id": "1e01a382",
                "analysis_id": "e410429b",
                "workflow": "nuvs",
                "index_id": "465428b0",
            },
            "created_at": static_time.datetime,
            "key": "bar",
            "rights": {},
            "status": [
                {
                    "error": None,
                    "timestamp": static_time.datetime,
                    "state": "waiting",
                    "stage": None,
                    "progress": 0,
                },
                {
                    "error": None,
                    "timestamp": static_time.datetime,
                    "state": "running",
                    "stage": None,
                    "progress": 0,
                },
                {
                    "error": None,
                    "timestamp": static_time.datetime,
                    "state": "running",
                    "stage": "mk_analysis_dir",
                    "progress": 0.091,
                },
                {
                    "error": None,
                    "timestamp": static_time.datetime,
                    "state": "complete",
                    "stage": "import_results",
                    "progress": 1.0,
                },
            ],
            "workflow": "build_index",
            "user": {"id": "igboyes"},
            "ping": None,
        },
    )
