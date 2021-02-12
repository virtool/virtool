import pytest

import virtool.jobs.db
from virtool.jobs.db import acquire, create
from virtool.jobs.utils import JobRights

status = {
    "state": "running",
    "progress": 0.5
}


async def test_processor(snapshot, dbi, static_time, test_job):
    """
    Test that the dispatch processor properly formats a raw job document into a dispatchable format.

    """
    processed = await virtool.jobs.db.processor(dbi, test_job)
    snapshot.assert_match(processed)


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

    snapshot.assert_match(await dbi.jobs.find_one())


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

    snapshot.assert_match(await dbi.jobs.find_one())


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




async def test_delete_zombies(dbi):
    documents = [
        {
            "_id": "boo",
            "status": [
                dict(status, state="waiting", progress=0),
                dict(status)
            ]
        },
        {
            "_id": "foo",
            "status": [
                dict(status),
                dict(status, state="cancelled", progress=0.6)
            ]
        },
        {
            "_id": "bar",
            "status": [
                dict(status),
                dict(status, state="error", progress=0.6)
            ]
        },
        {
            "_id": "baz",
            "status": [
                dict(status),
                dict(status, state="complete", progress=1)
            ]
        },
        {
            "_id": "bot",
            "status": [
                dict(status),
                dict(status, state="running", progress=0.3)
            ]
        }
    ]

    await dbi.jobs.insert_many(documents)

    await virtool.jobs.db.delete_zombies(dbi)

    assert await dbi.jobs.find({}, sort=[("_id", 1)]).to_list(None) == [
        documents[2],
        documents[3],
        documents[1]
    ]


@pytest.mark.parametrize("empty", [True, False], ids=["empty", "not-empty"])
async def test_get_waiting_and_running(empty, dbi):
    documents = list()

    if not empty:
        documents.append({
            "_id": "foo",
            "status": [
                {"state": "waiting"},
                {"state": "running"},
            ]
        })

    documents.append({
        "_id": "bar",
        "status": [
            {"state": "waiting"},
            {"state": "running"},
            {"state": "complete"}
        ]
    })

    if not empty:
        documents += [
            {
                "_id": "baz",
                "status": [
                    {"state": "waiting"}
                ]
            },
            {
                "_id": "bat",
                "status": [
                    {"state": "waiting"},
                    {"state": "running"}
                ]
            }
        ]

    await dbi.jobs.insert_many(documents)

    expected = list()

    if not empty:
        expected = ["foo", "baz", "bat"]

    assert await virtool.jobs.db.get_waiting_and_running_ids(dbi) == expected
