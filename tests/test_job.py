import time
import pytest
import datetime
from copy import deepcopy

import virtool.job


class TestDispatchProcessor:

    def test(self, test_db, test_job):
        """
        Test that the dispatch processor properly formats a raw job document into a dispatchable format.
         
        """
        test_db.jobs.insert_one(test_job)

        document = test_db.jobs.find_one()

        assert virtool.job.dispatch_processor(document) == {
            "id": "4c530449",
            "created_at": datetime.datetime(2017, 10, 6, 20, 0),
            "args": {
                "algorithm": "nuvs",
                "analysis_id": "e410429b",
                "index_id": "465428b0",
                "name": None,
                "sample_id": "1e01a382",
                "username": "igboyes"
            },
            "mem": 16,
            "proc": 10,
            "progress": 1.0,
            "stage": "import_results",
            "state": "complete",
            "task": "rebuild_index",
            "user": {
                "id": "igboyes"
            }
        }


class TestJob:

    def test_db_access(self, test_db, test_task_inst):
        """
        Test that the job process can write to the database.

        """
        job = test_task_inst

        job.start()

        while job.is_alive():
            time.sleep(0.1)

        assert [d for d in test_db.job_test.find({}, {"_id": False})] == [
            {"message": "hello world"}
        ]

    def test_static_calls(self, test_task_inst):
        """
        Test that the process can correctly submit static calls to the job manager through the Queue.

        """
        job = test_task_inst

        job.start()

        while job.is_alive():
            time.sleep(0.1)

        static_calls = list()

        while not job._queue.empty():
            static_calls.append(job._queue.get())

        assert static_calls == [
            ("foobar", "add_status", ("foobar", 0, "running", None, None), {}),
            ("foobar", "add_status", ("foobar", 0.33, "running", "say_message", None), {}),
            ("foobar", "pass_message", ("hello world",), {}),
            ('foobar', 'add_status', ('foobar', 0.67, 'running', 'do_db_op', None), {}),
            ('foobar', 'add_status', ('foobar', 1, 'complete', 'do_db_op', None), {})
        ]

    def test_python_error(self, test_task_inst):
        """
        Test that the process can correctly report and internal Python error and terminate as a result of it.

        """
        job = test_task_inst

        job.generate_python_error = True

        job.start()

        static_calls = list()

        while job.is_alive():
            while not job._queue.empty():
                static_call = job._queue.get()

                if static_call[2] == "error":
                    job.terminate()

                static_calls.append(static_call)

        while not job._queue.empty():
            static_calls.append(job._queue.get())

        assert static_calls[:3] == [
            ('foobar', 'add_status', ('foobar', 0, 'running', None, None), {}),
            ('foobar', 'add_status', ('foobar', 0.33, 'running', 'say_message', None), {}),
            ('foobar', 'pass_message', ('hello world',), {})
        ]

        assert static_calls[3][0] == "foobar"
        assert static_calls[3][1] == "add_status"

        args = static_calls[3][2]

        assert args[:4] == ('foobar', 1, 'error', 'say_message')

        assert args[4]["context"] == "Python Error"

        error = args[4]["message"]

        assert error["details"] == ["unsupported operand type(s) for +: 'int' and 'str'"]

        assert error["type"] == "TypeError"


class TestTermination:

    def test(self):
        """
        Test that the :class:`virtool.job.Termination` exception works properly.

        """
        with pytest.raises(virtool.job.Termination) as err:
            raise virtool.job.Termination

        assert "Termination" in str(err)


class TestJobError:

    def test(self):
        """
        Test that the :class:`virtool.job.JobError` exception works properly.
         
        """
        with pytest.raises(virtool.job.JobError) as err:
            raise virtool.job.JobError

        assert "JobError" in str(err)


class TestStageMethod:

    def test(self):
        """
        Test the the stage_method decorator adds a ``is_stage_method`` attribute to a function with a value of ``True``.
         
        """
        @virtool.job.stage_method
        def func():
            return "Hello world"

        assert func.is_stage_method is True
