from virtool.jobs.db import processor


async def test_processor(snapshot, dbi, fake2, static_time, test_job):
    """
    Test that the dispatch processor properly formats a raw job document into a
    dispatchable format.

    """
    user = await fake2.users.create()
    test_job["user"] = {"id": user.id}
    assert await processor(dbi, test_job) == snapshot
