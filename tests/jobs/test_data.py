from unittest.mock import call

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.jobs.client import JobsClient
from virtool.jobs.data import JobsData
from virtool.jobs.utils import JobRights


@pytest.fixture
async def jobs_data(dbi, mocker, pg: AsyncEngine) -> JobsData:
    return JobsData(mocker.Mock(spec=JobsClient), dbi, pg)


async def test_cancel(dbi, fake, jobs_data: JobsData, snapshot, static_time):
    user = await fake.users.insert()

    await dbi.jobs.insert_one(
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
            "user": {"id": user["_id"]},
        }
    )

    assert await jobs_data.cancel("foo") == snapshot
    assert await dbi.jobs.find_one() == snapshot


@pytest.mark.parametrize("job_id", ["bar", None])
async def test_create(
    job_id,
    jobs_data: JobsData,
    mocker,
    snapshot,
    dbi,
    test_random_alphanumeric,
    static_time,
):
    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    rights = JobRights()
    rights.samples.can_read("foo")
    rights.samples.can_modify("foo")
    rights.samples.can_remove("foo")

    assert (
        await jobs_data.create(
            "create_sample", {"sample_id": "foo"}, "bob", rights, job_id=job_id
        )
        == snapshot
    )

    assert await dbi.jobs.find_one() == snapshot


async def test_acquire(
    dbi, fake, jobs_data: JobsData, mocker, pg, snapshot, static_time
):
    user = await fake.users.insert()

    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    await dbi.jobs.insert_one(
        {"_id": "foo", "acquired": False, "key": None, "user": {"id": user["_id"]}}
    )

    assert await jobs_data.acquire("foo") == snapshot
    assert await dbi.jobs.find_one() == snapshot


async def test_force_delete_jobs(dbi, jobs_data: JobsData):
    await dbi.jobs.insert_many([{"_id": "foo"}, {"_id": "bar"}])

    await jobs_data.force_delete()

    jobs_data._client.cancel.assert_has_calls(
        [call("foo"), call("bar")], any_order=True
    )

    assert await dbi.jobs.count_documents({}) == 0
