"""
Classes, exceptions, and utilities for creating Virtool jobs.

"""
import io
import multiprocessing
import os
import queue
import signal
import subprocess
import sys
import threading
import traceback
from typing import Optional

import pymongo

import virtool.db.jobs
import virtool.utils


class Job(multiprocessing.Process):
    """
    :class:`~Job` can be subclassed to create new jobs that are compatible with Virtool.

    :param db_connection_string: the MongoDB connection string for the application database server
    :param db_name: the name of the application MongoDB database
    :param settings: a `dict` of settings that will be used by the job
    :param job_id: the job's unique ID that should already be associated with a job document in the database
    :param q:

    """

    def __init__(self, db_connection_string: str, db_name: str, settings: dict, job_id: str, q):
        super().__init__()

        #: The application database server connection string. See
        #: `Connection String URI Format <https://docs.mongodb.com/manual/reference/connection-string/>`_ in the MongoDB
        #: documentation.
        self.db_connection_string = db_connection_string

        #: The name of the application database.
        self.db_name = db_name

        #: A `dict` of application settings passed into the job when it was created.
        self.settings = settings

        #: The job's unique ID. It is associated with the job's database document.
        self.id = job_id

        #: A bidirectional :class:`multiprocessing.Queue` used for passing dispatch instructions to the API server.
        #:
        #: This queue is not used if message passing through Redis is enabled.
        self.q = q

        #: An instance of :class:`pymongo.database.Database` connected to the MongoDB database specified by
        #: :attr:`.db_connection_string` and :attr:`.db_name`.
        #:
        #: Value is ``None`` until :meth:`.init_db` is called.
        self.db = None

        #: The name of the job task (eg. `create_sample`).
        #:
        #: Value is ``None`` until :meth:`.init_db` is called.
        self.task_name = None

        #: Arguments attached to the job document by the API server.
        #:
        #: Value is ``None`` until :meth:`.init_db` is called.
        self.task_args = None

        #: The core limit for the job.
        #:
        #: Value is ``None`` until :meth:`.init_db` is called.
        self.proc = None

        #: The memory limit for the job.
        #:
        #: Value is ``None`` until :meth:`.init_db` is called.
        self.mem = None

        #: A :class:`dict` for storing parameters that will direct the job run. Parameters should be assigned in the
        #: redefinition of the :meth:`.check_db` method.
        self.params = dict()

        #: A :class:`dict` for storing data to be carried between stage methods.
        self.intermediate = dict()

        #: A :class:`dict` for storing results that should be written to file or database at the end of the job.
        self.results = dict()

        self._progress = 0
        self._state = "waiting"
        self._stage = None
        self._error = None
        self._process = None
        self._stage_list = None
        self._log_path = os.path.join(self.settings["data_path"], "logs", "jobs", self.id)
        self._log_buffer = list()

    def init_db(self):
        """
        Called in the :meth:`.run` method when the job starts.

        Initializes a database client using the :attr:`~db_connection_string` and :attr:`~db_name` attributes.

        The job document is fetched and used to set the :attr:`.task_name`, :attr:`.task_args`, :attr:`.proc`, and
        :attr:`.mem` attributes.

        """
        self.db = pymongo.MongoClient(self.db_connection_string, serverSelectionTimeoutMS=6000)[self.db_name]

        document = self.db.jobs.find_one(self.id)

        self.task_name = document["task"]
        self.task_args = document["args"]
        self.proc = document["proc"]
        self.mem = document["mem"]

    def check_db(self):
        """
        Intended to be redefined in subclasses of :class:`.Job`.

        This method is called immediately after :meth:`.init_db`, Populate the :attr:`.Job.params` state attribute here.
        These values are used to provide application data to the stage methods.

        Isolating calculation of :attr:`.Job.params` to this method simplifies the mocking required for unit testing
        individual stage methods.

        """
        pass

    def run(self):
        """
        The main job execution method. Methods in :attr:`.Job.stage_list` are executed sequentially.

        If ``SIGTERM`` is received, execution of stage methods is stopped and the job is put into the `cancelled` state
        by calling :meth:`.add_status`.

        If an error is encountered in a stage method or a subprocess, execution of stage methods is stopped. The error
        is recorded in :attr:`.Job._error` and the job is put into the `error` state by calling :meth:`.add_status`.

        Any dangling subprocess is killed and :meth:`.cleanup` is called if the job fails.

        """
        # Prevent the signal from propagating to the main server process.
        # See: https://stackoverflow.com/questions/50781181/os-kill-vs-process-terminate-within-aiohttp
        signal.set_wakeup_fd(-1)

        # Ignore keyboard interrupts. The manager will deal with the signal and cancel jobs safely.
        signal.signal(signal.SIGINT, signal.SIG_IGN)

        # When the manager terminates jobs, run the handle_sigterm method.
        signal.signal(signal.SIGTERM, handle_sigterm)

        self.init_db()
        self.check_db()

        try:
            for method in self._stage_list:
                name = method.__name__

                self.add_status(stage=name, state="running")
                self.add_log(f"Stage: {name}")

                method()

            self._progress = 1
            self.add_status(state="complete")

        except TerminationError:
            self.add_status(state="cancelled")

            if self._process:
                self._process.kill()

            self.cleanup()

        except:
            self._error = handle_exception()
            self.add_status(state="error")

            if self._process:
                self._process.kill()

            self.cleanup()

        self.flush_log()

    def run_subprocess(self, command: list, stdout_handler=None, stderr_handler=None, env: Optional[dict] = None):
        """
        A utility method for running a the passed `subprocess` command.

        It takes care of running a command and handling STDOUT and STDERR.

        :param command: the command to run in a subprocess
        :param stdout_handler: a function for handling STDOUT lines
        :param stderr_handler: a function for handling STDERR lines
        :param env: environmental variables to
        :return:
        """
        self.add_log(f"Command: {' '.join(command)}")

        if stdout_handler:
            stdout = subprocess.PIPE
        else:
            stdout = subprocess.DEVNULL

        if stderr_handler:
            def _stderr_handler(line):
                stderr_handler(line)
                self.add_log(line, indent=1)
        else:
            def _stderr_handler(line):
                self.add_log(line, indent=1)

        self._process = subprocess.Popen(command, stdout=stdout, stderr=subprocess.PIPE, env=env)

        stdout_queue = None
        stdout_thread = None

        if stdout_handler:
            stdout_queue = queue.Queue()

            stdout_thread = threading.Thread(
                target=watch_pipe,
                args=(self._process.stdout, stdout_queue),
                daemon=True
            )

            stdout_thread.start()

        stderr_queue = queue.Queue()

        stderr_thread = threading.Thread(
            target=watch_pipe,
            args=(self._process.stderr, stderr_queue),
            daemon=True
        )

        stderr_thread.start()

        while True:
            if stdout_queue:
                while not stdout_queue.empty():
                    out = stdout_queue.get()
                    stdout_handler(out)

            while not stderr_queue.empty():
                err = stderr_queue.get()
                _stderr_handler(err)

            alive = (stdout_thread and stdout_thread.is_alive()) or stderr_thread.is_alive()

            stdout_empty = not stdout_queue or stdout_queue.empty()

            if not alive and stderr_queue.empty() and stdout_empty and self._process.poll() is not None:
                break

        if self._process.returncode != 0:
            raise SubprocessError(f"Command failed: {' '.join(command)}. Check job log.")

        self._process = None

    def add_status(self, state=None, stage=None):
        """
        Add a status entry to the job database document that describes this job.

        :param state:
        :param stage:
        :return:
        """

        self._state = state or self._state
        self._stage = stage or self._stage

        if self._stage and self._progress != 1:
            stage_index = [m.__name__ for m in self._stage_list].index(self._stage)
            self._progress = round((stage_index + 1) / (len(self._stage_list) + 1), 2)

        self.db.jobs.update_one({"_id": self.id}, {
            "$push": {
                "status": {
                    "state": self._state,
                    "stage": self._stage,
                    "error": self._error,
                    "progress": self._progress,
                    "timestamp": virtool.utils.timestamp()
                }
            }
        })

        self.dispatch("jobs", "update", [self.id])

    def dispatch(self, interface: str, operation: str, id_list: list):
        """
        Using the job's messaging interface (:class:`multiprocessing.Queue` or Redis), send an instruction to the API
        server(s) to dispatch messages for the passed ``interface``, ``operation`` and ``id_list``.

        Operations can be one of: `insert`, `update`, or `remove`.

        Consider this call to :meth:`.Job.dispatch`:

        .. code-block:: python

            dispatch(
                "update",
                "analyses",
                ["ahj26ka"]
            )

        The above call would instruct the API server to dispatch the most recent version of the database document with
        the unique id `ahj26ka` in the analyses collection.

        This is useful when the job updates parts of the database and you want users to receive real time updates for
        the affected documents. For example, building a new reference index and setting the ``ready`` flag to ``True``
        on the database document representing the index. Sending a real-time update to the clients would allow the index
        UI component to change from a pending to active style.

        :param interface: the interface (ie. database collection) the message applies to
        :param operation: the operation to perform on the interface
        :param id_list: a list of ids whose documents should be dispatched

        """
        message = (
            interface,
            operation,
            id_list
        )

        self.q.put(message)

    def add_log(self, line: str, indent=0):
        timestamp = virtool.utils.timestamp().isoformat()

        indent_string = " " * indent * 4

        self._log_buffer.append(f"{timestamp}{indent_string}    {line.rstrip()}")

        if len(self._log_buffer) == 15:
            self.flush_log()
            del self._log_buffer[:]

    def flush_log(self):
        with open(self._log_path, "a") as f:
            f.write("\n".join(self._log_buffer))

    def cleanup(self):
        """
        Called when the job fails due to error or cancellation. It should clean up any files or
        database changes made by the job prior to its failure.

        By default, this method does nothing. It is intended to be replaced in a subclass.

        """
        pass


class SubprocessError(Exception):
    """
    This exception is raised when a subprocess run as part of a job encounters an error. The exception is handled in
    the main :meth:`.run` method

    """
    pass


class TerminationError(Exception):
    """
    This exception is raised when ``SIGTERM`` is handled in the job process. ``SIGTERM`` usually represents an attempt
    at cancellation of the job as a result of the process's :meth:`~multiprocessing.Process.terminate` being called.

    The exception is handled in the :meth:`.run` method and stops execution and leads the job into a cancelled state.

    """
    pass


def handle_exception(max_tb: Optional[int] = 50) -> dict:
    """
    Transforms an exception into a :class:`dict` describing the error. The dict can be stored in MongoDB and used to
    annotate a job document.

    Usage:

    .. code-block:: python

        try:
            cause_error()
        except:
            error = handle_exception()

    :param max_tb: maximum traceback depth
    :return: traceback data

    """
    exception, value, trace_info = sys.exc_info()

    return {
        "type": exception.__name__,
        "traceback": traceback.format_tb(trace_info, max_tb),
        "details": [str(l) for l in value.args]
    }


def handle_sigterm(*args):
    """
    A handler for SIGTERM signals. Raises a TerminationError in :meth:`.Job.run` that allows the job to clean-up after
    itself before terminating.

    A SIGTERM is generally received as the result of explicit cancellation of the job by a user.

    """
    raise TerminationError


def watch_pipe(stream: io.TextIOWrapper, q: queue.Queue):
    """
    A function for watching stdout and stderr pipes on subprocesses. Lines are read and pushed into the `q`. Queued
    lines are handled in :meth:`.Job.run`.

    This function is intended to be run in a separate thread.

    :param stream: a stdout or stderr file object
    :param q: a queue to push lines into

    """
    while True:
        line = stream.readline()

        if not line:
            return

        q.put(line)
