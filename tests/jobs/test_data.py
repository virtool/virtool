from datetime import datetime
from unittest.mock import call

import arrow
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy.matchers import path_type
from virtool_core.models.job import JobState

from virtool.fake.next import DataFaker
from virtool.jobs.client import JobsClient
from virtool.jobs.data import JobsData


@pytest.fixture()
async def jobs_data(mongo, mocker, pg: AsyncEngine) -> JobsData:
    return JobsData(mocker.Mock(spec=JobsClient), mongo, pg)


async def test_cancel(
    mongo, fake: DataFaker, jobs_data: JobsData, snapshot, static_time
):
    user = await fake.users.create()

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
                },
            ],
            "rights": {},
            "archived": False,
            "workflow": "build_index",
            "args": {},
            "user": {"id": user.id},
        },
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
    static_time,
    fake: DataFaker,
):
    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    user = await fake.users.create()

    job = await jobs_data.create(
        "create_sample", {"sample_id": "foo"}, user.id, 0, job_id=job_id
    )

    assert job == snapshot

    assert await mongo.jobs.find_one() == snapshot


async def test_acquire(
    mongo,
    fake: DataFaker,
    jobs_data: JobsData,
    mocker,
    pg,
    snapshot,
    static_time,
):
    user = await fake.users.create()

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
        },
    )

    assert await jobs_data.acquire("foo") == snapshot
    assert await mongo.jobs.find_one() == snapshot


async def test_force_delete_jobs(mongo, jobs_data: JobsData):
    await mongo.jobs.insert_many([{"_id": "foo"}, {"_id": "bar"}], session=None)

    await jobs_data.force_delete()

    jobs_data._client.cancel.assert_has_calls(
        [call("foo"), call("bar")],
        any_order=True,
    )

    assert await mongo.jobs.count_documents({}) == 0


async def test_timeout(fake: DataFaker, mongo, jobs_data: JobsData, snapshot):
    user = await fake.users.create()

    now = arrow.utcnow()

    async with mongo.create_session() as session:
        await mongo.jobs.insert_many(
            [
                # Ok: Newer than 30 days.
                {
                    "_id": "ok_new",
                    "archived": False,
                    "args": {},
                    "ping": None,
                    "rights": {},
                    "state": JobState.RUNNING.value,
                    "status": [
                        {
                            "state": JobState.WAITING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(days=-10).naive,
                        },
                        {
                            "state": JobState.RUNNING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(minutes=-1).naive,
                        },
                    ],
                    "user": {"id": user.id},
                    "workflow": "build_index",
                },
                # Ok: Pinged with the past 5 minutes.
                {
                    "_id": "ok_ping",
                    "archived": False,
                    "args": {},
                    "ping": {"pinged_at": now.shift(minutes=-1).naive},
                    "rights": {},
                    "state": JobState.RUNNING.value,
                    "status": [
                        {
                            "state": JobState.WAITING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(days=-10).naive,
                        },
                        {
                            "state": JobState.RUNNING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(minutes=-1).naive,
                        },
                    ],
                },
                # Ok: Not in running or preparing state.
                {
                    "_id": "ok_state",
                    "archived": False,
                    "args": {},
                    "ping": {"pinged_at": now.shift(minutes=-1).naive},
                    "rights": {},
                    "state": JobState.COMPLETE.value,
                    "status": [
                        {
                            "state": JobState.WAITING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(days=-10).naive,
                        },
                        {
                            "state": JobState.RUNNING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(minutes=-4).naive,
                        },
                        {
                            "state": JobState.COMPLETE.value,
                            "stage": "Bar",
                            "step_name": "bar",
                            "step_description": "bar a foo",
                            "error": None,
                            "progress": 1,
                            "timestamp": now.shift(minutes=-2).naive,
                        },
                    ],
                },
                # Bad: Older than 30 days.
                {
                    "_id": "bad_old",
                    "archived": False,
                    "args": {},
                    "ping": None,
                    "rights": {},
                    "state": JobState.RUNNING.value,
                    "status": [
                        {
                            "state": JobState.WAITING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(days=-42).naive,
                        },
                        {
                            "state": JobState.RUNNING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(minutes=-1).naive,
                        },
                    ],
                    "user": {"id": user.id},
                    "workflow": "build_index",
                },
                # Bad: Pinged more than 5 minutes ago.
                {
                    "_id": "bad_ping",
                    "archived": False,
                    "args": {},
                    "ping": {"pinged_at": now.shift(minutes=-6).naive},
                    "rights": {},
                    "state": JobState.RUNNING.value,
                    "status": [
                        {
                            "state": JobState.WAITING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(days=-1).naive,
                        },
                        {
                            "state": JobState.RUNNING.value,
                            "stage": "foo",
                            "step_name": "foo",
                            "step_description": "Foo a bar",
                            "error": None,
                            "progress": 0.33,
                            "timestamp": now.shift(minutes=-10).naive,
                        },
                    ],
                    "user": {"id": user.id},
                    "workflow": "build_index",
                },
            ],
            session=session,
        )

    await jobs_data.timeout()

    jobs = await mongo.jobs.find({}, ["_id", "state", "status"]).to_list(None)

    assert jobs == snapshot(matcher=path_type({".*timestamp": (datetime,)}, regex=True))
