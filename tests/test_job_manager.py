import time
import asyncio
import datetime
import pytest
from pprint import pprint

import virtool.errors


class TestInit:

    def test(self, test_job_manager):
        time.sleep(0.1)

        assert not test_job_manager.die

        test_job_manager.close()

        assert test_job_manager.die


class TestRun:

    @pytest.mark.parametrize("async_cb", [True, False])
    @pytest.mark.parametrize("keywords,full", [
        ({}, "hello world"),
        ({"caps": False}, "hello world"),
        ({"caps": True}, "HELLO WORLD")
    ])
    async def test_queue(self, keywords, full, async_cb, test_queue, test_job_manager):
        """
        Test the queue reading functionality of the job manager :meth:`.run` loop. The loop should successfully handle
        both synchronous and asynchronous registered callback functions. As well it should unpack and interpret passed
        ``args`` and ``kwargs`` parameters.
         
        """
        assert test_queue == test_job_manager.queue



        class Sayer:

            def __init__(self):
                self.said = None

            def say(self, first, second, caps=False):
                self.said = "{} {}".format(first, second)

                if caps:
                    self.said = self.said.upper()

            async def say_async(self, first, second, caps=False):
                self.say(first, second, caps)

        sayer = Sayer()

        if async_cb:
            test_job_manager.register_callback("say", sayer.say_async)
        else:
            test_job_manager.register_callback("say", sayer.say)

        test_queue.put({
            "job_id": "foobar",
            "cb_name": "say",
            "args": ["hello", "world"],
            "kwargs": keywords
        })

        await asyncio.sleep(0.5, loop=test_job_manager.loop)

        assert sayer.said == full

    @pytest.mark.parametrize("blocked", [True, False])
    async def test_start_job(self, blocked, mocker, test_job_manager):
        job_dict = {
            "obj": mocker.Mock(),
            "task": "rebuild_index",
            "started": False,
            "proc": 2,
            "mem": 4
        }

        test_job_manager.blocked = blocked

        test_job_manager._jobs_dict["foobar"] = job_dict

        await asyncio.sleep(0.3, loop=test_job_manager.loop)

        assert job_dict["started"] is not blocked
        assert job_dict["obj"].start.called is not blocked

        if not blocked:
            # If the job was allowed to start, check that used resource counts were updated.
            assert test_job_manager.used == {
                "proc": 2,
                "mem": 4
            }

            # if the job was allowed to start, check that task instance counts were updated.
            assert test_job_manager.task_counts["rebuild_index"] == 1

    @pytest.mark.parametrize("is_alive", [True, False])
    async def test_join_job(self, is_alive, mocker, test_job_manager):
        """
        Test that :meth:`~virtool.job.Job.join` is called for job processes that are no longer alive, but not for jobs
        that are still alive.
         
        """
        job_dict = {
            "obj": mocker.Mock(),
            "task": "rebuild_index",
            "started": False,
            "proc": 2,
            "mem": 4
        }

        # Use this stub to check if :meth:`.release_resources` is called when the job is joined.
        test_job_manager.release_resources = mocker.stub(name="release_resources")

        job_dict["obj"].is_alive.return_value = is_alive

        test_job_manager._jobs_dict["foobar"] = job_dict

        await asyncio.sleep(0.3, loop=test_job_manager.loop)

        # Make sure join is called on the job if it is no longer alive.
        assert job_dict["obj"].join.called is not is_alive

        if not is_alive:
            # Make sure job is popped from jobs dict if it is no longer alive.
            assert len(test_job_manager._jobs_dict) == 0

            # Make sure the job's resources are released if it was joined.
            assert test_job_manager.release_resources.call_args[0] == ("foobar",)


class TestRegisterCallback:

    def test(self, mocker, test_job_manager):

        m = mocker.stub(name="callback")

        test_job_manager.register_callback("hello_world", m)

        assert test_job_manager._callbacks["hello_world"]


class TestGetCallback:

    def test(self, mocker, test_job_manager):

        m = mocker.stub(name="callback")

        test_job_manager.register_callback("hello_world", m)

        assert test_job_manager.get_callback("hello_world") == m

    def test_missing_cb(self, mocker, test_job_manager):

        test_job_manager.register_callback("bye_world", mocker.stub(name="callback"))

        with pytest.raises(KeyError) as err:
            test_job_manager.get_callback("hello_world")

        assert "No callback with name 'hello_world'" in str(err)


class TestResume:

    async def test(self, static_time, test_db, test_job, test_job_manager, mock_job_class):
        test_job["status"] = test_job["status"][0]

        test_db.jobs.insert_one(test_job)

        await test_job_manager.resume()


class TestNew:

    async def test(self, static_time, test_db, test_job_manager, mock_job_class):
        """
        Test that :meth:`.Manager.new` creates all the right objects, database documents, and dispatches.
         
        """
        mock_class, mock_obj = mock_job_class

        await test_job_manager.new("rebuild_index", {"index": 5}, 5, 2, "test", job_id="foobar")

        # Test that the mock job class constructor was passed the correct args.
        assert mock_class.call_args[0] == (
            "foobar",
            {
                "db_host": "localhost",
                "db_name": "test",
                "db_port": 27017,
                "mem": 8,
                "proc": 4,
                "rebuild_index_inst": 2
            },
            test_job_manager.queue,
            "rebuild_index",
            {"index": 5},
            5,
            2
        )

        # Make sure new job_dict was formed properly.
        assert test_job_manager._jobs_dict == {
            "foobar": {
                "proc": 5,
                "mem": 2,
                "started": False,
                "task": "rebuild_index",
                "obj": mock_obj
            }
        }

        # Make sure a job document was added with the correct data.
        assert test_db.jobs.find_one() == {
            "_id": "foobar",
            "args": {
                "index": 5
            },
            "mem": 2,
            "proc": 5,
            "status": [
                {
                    "error": None,
                    "progress": 0,
                    "stage": None,
                    "state": "waiting",
                    "timestamp": datetime.datetime(2017, 10, 6, 20, 0)
                }
            ],
            "task": "rebuild_index",
            "user_id": "test"
        }

        assert test_job_manager.dispatch.call_args[0] == (
            "jobs",
            "update",
            {
                "added": datetime.datetime(2017, 10, 6, 20, 0),
                "job_id": "foobar",
                "mem": 2,
                "proc": 5,
                "progress": 0,
                "stage": None,
                "state": "waiting",
                "task": "rebuild_index",
                "user_id": "test"
            }
        )


class TestCancel:

    @pytest.mark.parametrize("started", [True, False])
    async def test(self, started, mocker, test_job_manager):
        m = mocker.stub(name="update_status")
        obj = mocker.Mock(name="obj")

        async def mock_update_status(*args, **kwargs):
            return m(*args, **kwargs)

        mocker.patch.object(test_job_manager, "update_status", new=mock_update_status)

        test_job_manager._jobs_dict["foobar"] = {
            "started": started,
            "task": "test",
            "obj": obj
        }

        assert not m.called
        assert not obj.cleanup.called

        await test_job_manager.cancel("foobar")

        if started:
            # These methods not called if the job was waiting.
            assert not m.called
            assert not obj.cleanup.called

            # This method is called for started jobs.
            assert obj.terminate.called

        else:
            # These methods are only called if the job was waiting.
            assert m.called
            assert obj.cleanup.called

            # This method is not called for waiting jobs.
            assert not obj.terminate.called

            # Check that the update status call_args are correct.
            assert m.call_args[0] == (
                "foobar",
                0,
                "cancelled",
                None
            )

    async def test_key_error(self, test_job_manager):
        """
        Test that attempting to call :meth:`.cancel` for a non-existent ``job_id`` raises a custom :class:`KeyError`.        

        """
        with pytest.raises(KeyError) as err:
            await test_job_manager.cancel("foobar")

        assert "Job object not found: 'foobar'" in str(err)


class TestUpdateStatus:

    @pytest.mark.parametrize("error", [False, "Error"])
    async def test(self, error, test_db, test_job_manager, static_time):
        """
        Test that :meth:`.update_status` updates the database and dispatches an update. Test non-error and error cases
        using parametrization.
         
        """
        test_db.jobs.insert_one({
            "_id": "foobar",
            "status": []
        })

        await test_job_manager.update_status(
            "foobar",
            0.5,
            error.lower() if error else "running",
            "hello_world",
            error=error
        )

        expected_db = {
            "_id": "foobar",
            "status": [
                {
                    "error": bool(error),
                    "progress": 0.5,
                    "stage": "hello_world",
                    "state": "running",
                    "timestamp": datetime.datetime(2017, 10, 6, 20, 0)
                }
            ]
        }

        if error:
            expected_db["status"][0].update({
                "error": "Error",
                "state": "error"
            })

        assert test_db.jobs.find_one() == expected_db

        expected_dispatch_args = (
            "jobs",
            "update",
            {
                "added": datetime.datetime(2017, 10, 6, 20, 0),
                "job_id": "foobar",
                "progress": 0.5,
                "stage": "hello_world",
                "state": "running"
            }
        )

        if error:
            expected_dispatch_args = (
                "jobs",
                "update",
                {
                    "added": datetime.datetime(2017, 10, 6, 20, 0),
                    "job_id": "foobar",
                    "progress": 0.5,
                    "stage": "hello_world",
                    "state": "error"
                }
            )

        assert test_job_manager.dispatch.call_args[0] == expected_dispatch_args

    async def test_does_not_exist(self, test_job_manager):
        """
        Test that attempting to update the status of a document with a non-existent ``job_id`` raises a
        :class:`virtool.errors.DatabaseError`.

        """
        with pytest.raises(virtool.errors.DatabaseError) as err:
            await test_job_manager.update_status("foobar", 0.5, "running", "hello_world", error=None)

        assert "Job does not exist: 'foobar'" in str(err)


class TestReleaseResources:

    def test(self, test_job_manager):
        """
        Test that resources can be released and task counts decremented given a valid ``job_id`.
         
        """
        test_job_manager._jobs_dict["foobar"] = {
            "started": True,
            "task": "rebuild_index",
            "proc": 2,
            "mem": 5
        }

        test_job_manager.task_counts["rebuild_index"] = 1

        test_job_manager.used.update({
            "proc": 2,
            "mem": 5
        })

        test_job_manager.release_resources("foobar")

        assert test_job_manager.task_counts["rebuild_index"] == 0

        assert test_job_manager.used == {
            "proc": 0,
            "mem": 0
        }

    def test_does_not_exist(self, test_job_manager):
        """
        Test that attempting to release resources for a non-existent ``job_id`` raises a custom :class:`KeyError`.
         
        """
        test_job_manager.task_counts["rebuild_index"] = 1

        test_job_manager.used.update({
            "proc": 2,
            "mem": 5
        })

        with pytest.raises(KeyError) as err:
            test_job_manager.release_resources("foobar")

        assert "Job object not found: 'foobar'" in str(err)


class TestResourceAvailable:

    @pytest.mark.parametrize("proc_limit, mem_limit", [(5, 5), (10, 10)])
    @pytest.mark.parametrize("proc_used, mem_used", [(0, 0), (5, 5), (10, 10)])
    @pytest.mark.parametrize("proc, mem", [(5, 0), (0, 5), (5, 5), (10, 0), (0, 10), (10, 10)])
    def test(self, proc_limit, mem_limit, proc_used, mem_used, proc, mem, test_job_manager):
        """
        Test that :meth:`.resources_available` works as advertised.
         
        """
        test_job_manager.settings.update({
            "proc": proc_limit,
            "mem": mem_limit
        })

        test_job_manager.used.update({
            "proc": proc_used,
            "mem": mem_used
        })

        expected = proc <= proc_limit - proc_used and mem <= mem_limit - mem_used

        assert test_job_manager.resources_available(proc, mem) == expected


class TestResources:

    @pytest.mark.parametrize("proc_limit, mem_limit", [(5, 5), (10, 10)])
    @pytest.mark.parametrize("proc_used, mem_used", [(0, 0), (5, 5), (10, 10)])
    def test(self, proc_limit, mem_limit, proc_used, mem_used, test_job_manager):
        test_job_manager.settings.update({
            "proc": proc_limit,
            "mem": mem_limit
        })

        test_job_manager.used.update({
            "proc": proc_used,
            "mem": mem_used
        })

        expected = {
            "used": {
                "proc": proc_used,
                "mem": mem_used
            },
            "available": {
                "proc": proc_limit - proc_used,
                "mem": mem_limit - mem_used
            },
            "limit": {
                "proc": proc_limit,
                "mem": mem_limit
            }
        }

        assert test_job_manager.resources == expected


class TestClose:

    def test(self, test_job_manager):
        assert test_job_manager.die is False

        test_job_manager.close()

        assert test_job_manager.die is True
