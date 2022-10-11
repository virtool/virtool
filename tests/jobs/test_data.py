from unittest.mock import call

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.jobs.client import JobsClient
from virtool.jobs.data import JobsData
from virtool.jobs.utils import JobRights, compose_status


@pytest.fixture
async def jobs_data(mongo, mocker, pg: AsyncEngine) -> JobsData:
    return JobsData(mocker.Mock(spec=JobsClient), mongo, pg)


async def test_cancel(mongo, fake2, jobs_data: JobsData, snapshot, static_time):
    user = await fake2.users.create()

    await mongo.jobs.insert_one(
        {
            "_id": "foo",
            "state": "waiting",
            "status": [
                {
                    "state": "running",
                    "stage": "foo",
                    "error": None,
                    "progress": 0.33,
                    "timestamp": static_time.datetime,
                }
            ],
            "rights": {},
            "archived": False,
            "workflow": "build_index",
            "args": {},
            "user": {"id": user.id},
        }
    )

    assert await jobs_data.cancel("foo") == snapshot
    assert await mongo.jobs.find_one() == snapshot


@pytest.mark.parametrize("job_id", ["bar", None])
async def test_create(
    job_id,
    jobs_data: JobsData,
    mocker,
    snapshot,
    mongo,
    test_random_alphanumeric,
    static_time,
    fake,
):
    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    rights = JobRights()
    rights.samples.can_read("foo")
    rights.samples.can_modify("foo")
    rights.samples.can_remove("foo")

    user = await fake.users.insert()

    assert (
        await jobs_data.create(
            "create_sample", {"sample_id": "foo"}, user["_id"], rights, job_id=job_id
        )
        == snapshot
    )

    assert await mongo.jobs.find_one() == snapshot


async def test_acquire(
    mongo, fake2, jobs_data: JobsData, mocker, pg, snapshot, static_time
):
    user = await fake2.users.create()

    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    await mongo.jobs.insert_one(
        {
            "_id": "foo",
            "acquired": False,
            "key": None,
            "rights": {},
            "archived": False,
            "workflow": "build_index",
            "args": {},
            "user": {"id": user.id},
        }
    )

    assert await jobs_data.acquire("foo") == snapshot
    assert await mongo.jobs.find_one() == snapshot


async def test_archive(mongo, fake2, jobs_data: JobsData, pg, snapshot, static_time):
    user = await fake2.users.create()

    status = compose_status("waiting", None)

    await mongo.jobs.insert_one(
        {
            "_id": "foo",
            "status": [status],
            "archived": False,
            "acquired": False,
            "key": None,
            "user": {"id": user.id},
            "rights": {},
            "workflow": "build_index",
            "args": {},
        }
    )

    assert await jobs_data.archive("foo", False) == snapshot
    assert await mongo.jobs.find_one() == snapshot


async def test_force_delete_jobs(mongo, jobs_data: JobsData):
    await mongo.jobs.insert_many([{"_id": "foo"}, {"_id": "bar"}])

    await jobs_data.force_delete()

    jobs_data._client.cancel.assert_has_calls(
        [call("foo"), call("bar")], any_order=True
    )

    assert await mongo.jobs.count_documents({}) == 0
