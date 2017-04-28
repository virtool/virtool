import pytest
import multiprocessing
from copy import deepcopy
from pprint import pprint

import virtool.job


class TestProcessor:

    def test(self, test_job):
        """
        Test that the processor changes the ``_id`` field to ``job_id``.
         
        """
        processed = virtool.job.processor(deepcopy(test_job))

        test_job["job_id"] = test_job.pop("_id")

        assert processed == test_job


class TestDispatchProcessor:

    def test(self, test_job):
        """
        Test that the dispatch processor properly formats a raw job document into a dispatchable format.
         
        """
        assert virtool.job.dispatch_processor(test_job) == {
            "added": "2017-03-24T13:20:35.780926",
            "args": {
                "algorithm": "nuvs",
                "analysis_id": "e410429b",
                "index_id": "465428b0",
                "name": None,
                "sample_id": "1e01a382",
                "username": "igboyes"
            },
            "job_id": "4c530449",
            "mem": 16,
            "proc": 10,
            "progress": 1.0,
            "stage": "import_results",
            "state": "complete",
            "task": "nuvs",
            "user_id": "igboyes"
        }


class TestJob:

    def test(self, mocker):
        job_id = "foobar"

        settings = {
            "db_name": "test",
            "db_host": "localhost",
            "db_port": 27017
        }

        queue = multiprocessing.Queue()

        task = "foobar"
        task_args = dict()
        proc = 1
        mem = 1

        m = mocker.patch("setproctitle.setproctitle")

        job = virtool.job.Job(job_id, settings, queue, task, task_args, proc, mem)

        assert job._job_id == job_id

        job.start()

        print(queue.get())
        print(queue.get())

        assert 0


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
