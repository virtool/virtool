import pytest

from virtool.jobs.client import DummyJobsClient
from virtool_core.models.job import JobState

from virtool.jobs.data import JobsData


async def sleep_patch():
    pass


@pytest.mark.parametrize(
    "state,listed,",
    [
        (JobState.WAITING.value, False),
        (JobState.PREPARING.value, False),
        (JobState.WAITING.value, True),
    ],
)
async def test_relist_jobs(fake2, pg, mongo, mocker, state, listed, snapshot):
    """
    Test that jobs are relisted in redis that are in the waiting state and are no longer in redis.

    """

    user = await fake2.users.create()
    job = await fake2.jobs.create(user)
    dummy_client = DummyJobsClient()

    mocker.patch("virtool.jobs.data.asyncio.sleep", function=sleep_patch)

    if listed:
        await dummy_client.enqueue(job.workflow, job.id)
        assert (await dummy_client.list()) == [job.id]

    if state != JobState.WAITING.value:
        await mongo.jobs.update_one({"_id": job.id}, {"$set": {"state": state}})

    jobs_data = JobsData(dummy_client, mongo, pg)
    await jobs_data.relist()

    assert dummy_client.enqueued == snapshot
