from virtool.jobs.db import fetch_complete_job


async def test_fetch_complete_job(snapshot, fake2, mongo, static_time, test_job):
    user = await fake2.users.create()
    test_job["user"] = {"id": user.id}

    result = dict(await fetch_complete_job(mongo, test_job))

    assert result == snapshot
