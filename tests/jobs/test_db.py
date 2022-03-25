from virtool.jobs.db import processor


async def test_processor(snapshot, dbi, fake, static_time, test_job):
    """
    Test that the dispatch processor properly formats a raw job document into a
    dispatchable format.

    """
    user = await fake.users.insert()
    test_job["user"] = {"id": user["_id"]}
    assert await processor(dbi, test_job) == snapshot
