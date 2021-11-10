from unittest.mock import call

import pytest
import virtool.jobs.db
from virtool.jobs.client import JobsClient
from virtool.jobs.db import acquire, create, force_delete_jobs
from virtool.jobs.utils import JobRights

status = {
    "state": "running",
    "progress": 0.5
}


async def test_processor(snapshot, dbi, static_time, test_job):
    """
    Test that the dispatch processor properly formats a raw job document into a dispatchable format.

    """
    assert await virtool.jobs.db.processor(dbi, test_job) == snapshot


async def test_cancel(snapshot, dbi, static_time):
    await dbi.jobs.insert_one({
        "_id": "foo",
        "state": "waiting",
        "status": [{
            "state": "running",
            "stage": "foo",
            "error": None,
            "progress": 0.33,
            "timestamp": static_time.datetime
        }]
    })

    await virtool.jobs.db.cancel(dbi, "foo")

    assert await dbi.jobs.find_one() == snapshot


@pytest.mark.parametrize("with_job_id", [False, True])
async def test_create(with_job_id, mocker, snapshot, dbi, test_random_alphanumeric, static_time):
    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    rights = JobRights()
    rights.samples.can_read("foo")
    rights.samples.can_modify("foo")
    rights.samples.can_remove("foo")

    if with_job_id:
        await create(dbi, "create_sample", {"sample_id": "foo"}, "bob", rights, job_id="bar")
    else:
        await create(dbi, "create_sample", {"sample_id": "foo"}, "bob", rights)

    assert await dbi.jobs.find_one() == snapshot


async def test_acquire(dbi, mocker):
    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    await dbi.jobs.insert_one({
        "_id": "foo",
        "acquired": False,
        "key": None
    })

    result = await acquire(dbi, "foo")

    assert await dbi.jobs.find_one() == {
        "_id": "foo",
        "acquired": True,
        "key": "hashed"
    }

    assert result == {
        "id": "foo",
        "acquired": True,
        "key": "key"
    }


async def test_force_delete_jobs(dbi, mocker, tmp_path):
    app = {
        "db": dbi,
        "jobs": mocker.Mock(spec=JobsClient)
    }

    await dbi.jobs.insert_many([
        {"_id": "foo"},
        {"_id": "bar"}
    ])

    await force_delete_jobs(app)

    app["jobs"].cancel.assert_has_calls(
        [call("foo"), call("bar")],
        any_order=True
    )

    assert await dbi.jobs.count_documents({}) == 0
