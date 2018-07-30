import multiprocessing
import threading
import queue
import os
import signal
import subprocess
import sys
import traceback

import pymongo

import virtool.db.iface
import virtool.db.jobs
import virtool.errors
import virtool.utils


class TerminationError(Exception):
    pass


class Job(multiprocessing.Process):

    def __init__(self, db_connection_string, settings, job_id, queue):
        super().__init__()

        self.db_connection_string = db_connection_string
        self.settings = settings
        self.id = job_id
        self.queue = queue

        self.db = None
        self.task_name = None
        self.task_args = None
        self.proc = None
        self.mem = None

        self._progress = 0
        self._state = "waiting"
        self._stage = None
        self._error = None
        self._process = None
        self._stage_list = None
        self._log_path = os.path.join(self.settings["data_path"], "logs", "jobs", self.id)
        self._log_buffer = list()

    def run(self):
        # Ignore keyboard interrupts. The manager will deal with the signal and cancel jobs safely.
        signal.signal(signal.SIGINT, signal.SIG_IGN)

        # When the manager terminates jobs, run the handle_sigterm method.
        signal.signal(signal.SIGTERM, handle_sigterm)

        self.db = pymongo.MongoClient(self.db_connection_string, serverSelectionTimeoutMS=6000)["vt3"]

        document = self.db.jobs.find_one(self.id)

        self.task_name = document["task"]
        self.task_args = document["args"]
        self.proc = document["proc"]
        self.mem = document["mem"]

        try:
            for method in self._stage_list:
                name = method.__name__

                self.add_status(stage=name, state="running")
                self.add_log("Stage: {}".format(name))

                method()

            self._progress = 1
            self.add_status(state="complete")

        except TerminationError:
            self.add_status(state="cancelled")
            self.cleanup()

        except:
            self._error = handle_exception()
            self.add_status(state="error")
            self.cleanup()

        if self._process:
            self._process.kill()

        self.flush_log()

    def run_subprocess(self, command, stdout_handler=None, stderr_handler=None, env=None):
        self.add_log("Command: {}".format(" ".join(command)))

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
            if self._process.poll() is not None:
                break

            if stdout_queue and not stdout_queue.empty():
                out = stdout_queue.get()
                stdout_handler(out)

            if not stderr_queue.empty():
                err = stderr_queue.get()
                _stderr_handler(err)

        if self._process.returncode != 0:
            raise virtool.errors.SubprocessError("Command failed: {}. Check job log.".format(" ".join(command)))

        self._process = None

    def add_status(self, state=None, stage=None):
        self._state = state or self._state
        self._stage = stage or self._stage

        if self._stage and self._progress != 1:
            stage_index = [m.__name__ for m in self._stage_list].index(self._stage)
            self._progress = round((stage_index + 1) / (len(self._stage_list) + 1), 2)

        document = self.db.jobs.find_one_and_update({"_id": self.id}, {
            "$push": {
                "status": {
                    "state": self._state,
                    "stage": self._stage,
                    "error": self._error,
                    "progress": self._progress,
                    "timestamp": virtool.utils.timestamp()
                }
            }
        }, return_document=pymongo.ReturnDocument.AFTER, projection=virtool.db.jobs.PROJECTION)

        self.dispatch("jobs", "update", virtool.db.jobs.processor(document))

    def dispatch(self, interface, operation, data):
        message = (
            interface,
            operation,
            data
        )

        self.queue.put(message)

    def add_log(self, line, indent=0):
        timestamp = virtool.utils.timestamp().isoformat()

        self._log_buffer.append("{}{}    {}".format(timestamp, " " * indent * 4, line.rstrip()))

        if len(self._log_buffer) == 15:
            self.flush_log()
            del self._log_buffer[:]

    def flush_log(self):
        with open(self._log_path, "a") as f:
            f.write("\n".join(self._log_buffer))

    def cleanup(self):
        pass


def handle_exception(max_tb=50):
    exception, value, trace_info = sys.exc_info()

    return {
        "type": exception.__name__,
        "traceback": traceback.format_tb(trace_info, max_tb),
        "details": [str(l) for l in value.args]
    }


def handle_sigterm():
    """
    A handler for SIGTERM signals. Raises a TerminationError that allows the job to clean-up after itself.

    """
    raise TerminationError


def stage_method(func):
    func.is_stage_method = True
    return func


def watch_pipe(stream, queue):
    while True:
        line = stream.readline()

        if not line:
            return

        queue.put(line)
