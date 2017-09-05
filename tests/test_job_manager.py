import pytest
import asyncio
import virtool.job
import virtool.job_manager


@pytest.fixture
def test_job_manager(capsys, tmpdir, loop, test_motor, test_dispatch):
    settings = {
        "proc": 6,
        "mem": 24,
        "dummy_proc": 2,
        "dummy_mem": 4,
        "data_path": str(tmpdir)
    }

    tmpdir.mkdir("logs").mkdir("jobs")

    manager = virtool.job_manager.Manager(loop, test_motor, settings, test_dispatch)

    manager.start()

    yield manager


class TestStarted:

    async def test(self, test_job_manager):
        assert test_job_manager.get_resources() == {
            "limit": {
                "proc": 6,
                "mem": 24
            },
            "used": {
                "proc": 0,
                "mem": 0
            },
            "available": {
                "proc": 6,
                "mem": 24
            }
        }

        assert test_job_manager.started


class TestNew:

    @pytest.mark.parametrize("use_executor,result", [
        (True, "I ran in an executor. My message is hello world"),
        (False, "I didn't run in an executor. My message is hello world")
    ])
    async def test(self, loop, use_executor, result, test_job_manager, test_random_alphanumeric, static_time):
        assert test_job_manager.get_resources() == {
            "limit": {
                "proc": 6,
                "mem": 24
            },
            "used": {
                "proc": 0,
                "mem": 0
            },
            "available": {
                "proc": 6,
                "mem": 24
            }
        }

        target = list()

        await test_job_manager.new("dummy", {
            "message": "hello world",
            "target": target,
            "use_executor": use_executor
        }, "test")

        await asyncio.sleep(1, loop=loop)

        assert await test_job_manager.db.jobs.find_one() == {
            "_id": test_random_alphanumeric.last_choice,
            "args": {
                "message": "hello world",
                "target": [],
                "use_executor": use_executor
            },
            "mem": 4,
            "proc": 2,
            "status": [
                {
                    "error": None,
                    "progress": 0,
                    "stage": None,
                    "state": "waiting",
                    "timestamp": static_time
                },
                {
                    "error": None,
                    "progress": 0.33,
                    "stage": "prepare",
                    "state": "running",
                    "timestamp": static_time
                },
                {
                    "error": None,
                    "progress": 0.67,
                    "stage": "say_message",
                    "state": "running",
                    "timestamp": static_time
                },
                {
                    "error": None,
                    "progress": 1,
                    "stage": "say_message",
                    "state": "complete",
                    "timestamp": static_time
                }
            ],
            "task": "dummy",
            "user": {
                "id": "test"
            }
        }

        assert target == [result]

    @pytest.mark.parametrize("use_executor", [True, False])
    async def test_exception(self, loop, use_executor, test_job_manager, test_random_alphanumeric, static_time):
        """
        Test that an exception in a stage_method leads to an error log in the job document.

        """
        await test_job_manager.new("dummy", {
            "message": 1337,
            "use_executor": use_executor
        }, "test")

        count = 0

        while True:
            document = await test_job_manager.db.jobs.find_one()

            last_status = document["status"].pop(-1)

            if last_status["error"]:
                break

            if count == 15:
                raise TimeoutError("Timed out waiting for job to error")

            count += 1

            await asyncio.sleep(0.3, loop=loop)

        assert document == {
            "_id": test_random_alphanumeric.last_choice,
            "args": {
                "message": 1337,
                "use_executor": use_executor
            },
            "mem": 4,
            "proc": 2,
            "status": [
                {
                    "error": None,
                    "progress": 0,
                    "stage": None,
                    "state": "waiting",
                    "timestamp": static_time
                },
                {
                    "error": None,
                    "progress": 0.33,
                    "stage": "prepare",
                    "state": "running",
                    "timestamp": static_time
                },
                {
                    "error": None,
                    "progress": 0.67,
                    "stage": "say_message",
                    "state": "running",
                    "timestamp": static_time
                }
            ],
            "task": "dummy",
            "user": {
                "id": "test"
            }
        }

        assert last_status["error"]["details"] == ["Can't convert 'int' object to str implicitly"]
        assert last_status["error"]["type"] == "TypeError"


class TestCancel:

    async def test(self, test_job_manager, test_random_alphanumeric, static_time):
        await test_job_manager.new("dummy", {"message": "Hello world"}, "test")

        await asyncio.sleep(0.5, loop=test_job_manager.loop)

        assert await test_job_manager.db.jobs.find_one() == {
            "_id": test_random_alphanumeric.last_choice,
            "args": {
                "message": "Hello world"
            },
            "mem": 4,
            "proc": 2,
            "status": [
                {
                    "error": None,
                    "progress": 0,
                    "stage": None,
                    "state": "waiting",
                    "timestamp": static_time
                },
                {
                    "error": None,
                    "progress": 0.33,
                    "stage": "prepare",
                    "state": "running",
                    "timestamp": static_time
                },
                {
                    "error": None,
                    "progress": 0.67,
                    "stage": "say_message",
                    "state": "running",
                    "timestamp": static_time
                },
                {
                    "error": None,
                    "progress": 1,
                    "stage": "say_message",
                    "state": "complete",
                    "timestamp": static_time
                }
            ],
            "task": "dummy",
            "user": {
                "id": "test"
            }
        }


class TestGetResources:

    async def test(self, test_job_manager):
        assert test_job_manager.get_resources() == {
            "limit": {
                "proc": 6,
                "mem": 24
            },
            "used": {
                "proc": 0,
                "mem": 0
            },
            "available": {
                "proc": 6,
                "mem": 24
            }
        }


class TestReserveResources:

    async def test(self, test_job_manager):
        mock_job = virtool.job.Job(
            test_job_manager.loop,
            test_job_manager.executor,
            test_job_manager.db,
            test_job_manager.settings,
            test_job_manager.dispatch,
            "foobar",
            "dummy",
            {},
            2,
            4
        )

        test_job_manager.reserve_resources(mock_job)

        assert test_job_manager.get_resources() == {
            "limit": {
                "proc": 6,
                "mem": 24
            },
            "used": {
                "proc": 2,
                "mem": 4
            },
            "available": {
                "proc": 4,
                "mem": 20
            }
        }

    async def test_multiple(self, test_job_manager):
        mock_job_1 = virtool.job.Job(
            test_job_manager.loop,
            test_job_manager.executor,
            test_job_manager.db,
            test_job_manager.settings,
            test_job_manager.dispatch,
            "foobar",
            "dummy",
            {},
            2,
            8
        )

        mock_job_2 = mock_job = virtool.job.Job(
            test_job_manager.loop,
            test_job_manager.executor,
            test_job_manager.db,
            test_job_manager.settings,
            test_job_manager.dispatch,
            "foobar",
            "dummy",
            {},
            1,
            2
        )

        test_job_manager.reserve_resources(mock_job_1)
        test_job_manager.reserve_resources(mock_job_2)

        assert test_job_manager.get_resources() == {
            "limit": {
                "proc": 6,
                "mem": 24
            },
            "used": {
                "proc": 3,
                "mem": 10
            },
            "available": {
                "proc": 3,
                "mem": 14
            }
        }


class TestReleaseResources:

    async def test(self, test_job_manager):
        mock_job = virtool.job.Job(
            test_job_manager.loop,
            test_job_manager.executor,
            test_job_manager.db,
            test_job_manager.settings,
            test_job_manager.dispatch,
            "foobar",
            "dummy",
            {},
            2,
            4
        )

        test_job_manager.reserve_resources(mock_job)

        assert test_job_manager.get_resources() == {
            "limit": {
                "proc": 6,
                "mem": 24
            },
            "used": {
                "proc": 2,
                "mem": 4
            },
            "available": {
                "proc": 4,
                "mem": 20
            }
        }

        test_job_manager.release_resources(mock_job)

        assert test_job_manager.get_resources() == {
            "limit": {
                "proc": 6,
                "mem": 24
            },
            "used": {
                "proc": 0,
                "mem": 0
            },
            "available": {
                "proc": 6,
                "mem": 24
            }
        }


class TestGetResources:

    async def test(self, test_job_manager):
        assert test_job_manager.get_resources() == {
            "limit": {
                "proc": 6,
                "mem": 24
            },
            "used": {
                "proc": 0,
                "mem": 0
            },
            "available": {
                "proc": 6,
                "mem": 24
            }
        }


class TestClose:

    async def test_stop(self, test_job_manager):
        assert not test_job_manager._stop

        await test_job_manager.close()

        assert test_job_manager._stop
