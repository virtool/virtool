from virtool_core.models.job import Job

from virtool.jobs.db import fetch_complete_job

async def test_fetch_complete_job(snapshot, mongo, fake2, static_time, test_job):
    user = await fake2.users.create()
    test_job["user"] = {"id": user.id}

    assert await fetch_complete_job(mongo, test_job) == snapshot
