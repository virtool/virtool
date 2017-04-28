import os
import sys
import signal
import pymongo
import traceback
import multiprocessing
import subprocess
import setproctitle


PROJECTION = [
    "_id",
    "task",
    "status",
    "proc",
    "mem",
    "user_id"
]


def processor(document):
    """
    Process a job document for transmission to a client.
    
    :param document: a job document
    :type document: dict
    
    :return: a processed job document
    :rtype: dict
    
    """
    document["job_id"] = document.pop("_id")
    return document


def dispatch_processor(document):
    """
    Removes the ``status`` and ``args`` fields from the job document.

    Adds a ``username`` field, an ``added`` date taken from the first status entry in the job document, and
    ``state`` and ``progress`` fields taken from the most recent status entry in the job document.

    :param document: a document to process.
    :type document: dict

    :return: a processed documents.
    :rtype: dict

    """
    status = document.pop("status")

    last_update = status[-1]

    document.update({
        "job_id": document.pop("_id"),
        "state": last_update["state"],
        "stage": last_update["stage"],
        "added": status[0]["timestamp"],
        "progress": status[-1]["progress"]
    })

    return document


class Job(multiprocessing.Process):

    def __init__(self, job_id, settings, message_queue, task, task_args, proc, mem):
        super().__init__()

        #: The job's database id.
        self._job_id = job_id

        #: A dict of server settings.
        self._settings = settings

        #: Used to communicate with the main process.
        self._queue = message_queue

        #: The task name.
        self._task = task

        #: The task args passed from the :meth:`.jobs.Collection.new` method.
        self._task_args = task_args

        #: The number of cores the job is allowed to use.
        self._proc = proc

        #: The amount of memory in GB that the job is allowed to use.
        self._mem = mem

        # If the job owns an external subprocess, the subprocess.Popen object will be referred to by this attribute. If
        # no process is open, the attribute is set to None.
        self._process = None

        self._stage_list = list()
        self.stage_counter = 0
        self.progress = 0

        self._do_cleanup = False

        self._state = "waiting"
        self._stage = None
        self._error = None

        db_host = self._settings["db_host"]
        db_port = self._settings["db_port"]
        db_name = self._settings["db_name"]

        self.db = pymongo.MongoClient(host=db_host, port=db_port)[db_name]

    def run(self):

        # Set the process title so that it is easily identifiable as a virtool job process.
        setproctitle.setproctitle("virtool-" + self._job_id)

        # Ignore keyboard interrupts. The manager will deal with the signal and cancel jobs safely.
        signal.signal(signal.SIGINT, signal.SIG_IGN)

        # When the manager terminates jobs, call :meth:`.handle_sigterm`.
        signal.signal(signal.SIGTERM, handle_sigterm)

        was_cancelled = False

        try:
            # Tell the database that the job has started running
            self.update_status(state="running")

            try:
                # Run the commands in the command list
                for method in self._stage_list:
                    self.stage_counter += 1

                    self.progress = round(self.stage_counter / (len(self._stage_list) + 2), 3)

                    # Get the function name and use it to tell the jobs collection that a new stage has been started.
                    self.update_status(stage=method.__name__)

                    # Run the command function
                    method()
            except:
                # Handle exceptions in the Python code
                exception = handle_exception()

                # This conditional will only be True and raise a Termination exception if the source of the termination
                # is cancellation of the job by a user. Job errors will not result in a Termination exception being
                # raised here.
                if exception["type"] == "Termination":
                    # Re-raise the exception so it can be handled outside the func execution loop.
                    raise Termination

                elif exception["type"] == "JobError":
                    # Re-raise the exception so it can be handled outside the func execution loop.
                    raise JobError

                # An error has occurred. Handle and parse the error and traceback using the handle_error method.
                else:
                    self._error = {
                        "message": exception,
                        "context": "Python Error"
                    }
                    raise JobError

            # Tell the database that the job has completed. This line is only reached if no error or cancellation
            # occurs.
            self.update_status(state="complete", stage=None)

        except Termination:
            # The Termination exception will only be caught here when the termination is due to cancellation of the job
            # by the user.
            was_cancelled = True

            self._do_cleanup = True

            # Terminate any owned subprocess and log the outcome.
            try:
                self._process.terminate()
            except AttributeError:
                pass

        except JobError:

            self.update_status(state="error", stage=self._stage, error=self._error)

            try:
                # Wait after the JobError exception while the server gets around to calling the terminate method.
                while True:
                    pass

            except Termination:
                # When it does, the Terminate exception will be raised and we will continue shutting down the job.
                self._do_cleanup = True

        # Clean-up intermediate files and database changes if the job is ending due to cancellation or and error.
        if self._do_cleanup:
            self.cleanup()

        if was_cancelled:
            self.update_status(state="cancelled")

    def run_process(self, cmd, stdout_handler=None, dont_read_stdout=False, no_output_failure=False, env=None):
        """
        Wraps :class:`subprocess.Popen`. Takes a command (list) that is run with all output be cleanly handled in
        real time. Also takes handler methods for stdout and stderr lines. These will be called anytime new output is
        available and be passed the line. If the process encounters an error as identified by the return code, it is
        handled just like a Python error.

        """
        stderr = None

        output = None
        stdout_handle = subprocess.DEVNULL

        if not dont_read_stdout:
            stdout_handle = subprocess.PIPE

            if not stdout_handler:
                output = list()
                stdout_handler = output.append

        try:
            with subprocess.Popen(cmd, stdout=stdout_handle, stderr=subprocess.PIPE, env=env, universal_newlines=True) as process:
                if not dont_read_stdout:
                    for line in process.stdout:
                        stdout_handler(line.rstrip())
                        if output is None:
                            output = True

                stderr = process.stderr.read()

        except subprocess.CalledProcessError:
            self._error = {
                "message": ["Returned " + str(self._process.returncode), "Check log."],
                "context": "External Process Error"
            }

        if no_output_failure and not output:
            self._error = {
                "message": stderr.split("\n"),
                "context": "External Process Error"
            }

        if self._error:
            raise JobError

        # Set the process attribute to None, indicating that there is no running external process.
        self._process = None

        return output

    def update_status(self, state=None, stage=None, error=None):
        """
        Report changes in job state and stage and any errors to the job manager. Any changes are also logged to the job
        log.

        """
        # Set the state and stage attributes if they are changed by this status update.
        self._state = state or self._state
        self._stage = stage or self._stage

        # Instruct the manager to update the jobs database collection with the new status information.
        self.collection_operation("jobs", "update_status", {
            "_id": self._job_id,
            "progress": self.progress,
            "state": self._state,
            "stage": self._stage,
            "error": error
        })

    def collection_operation(self, collection_name, operation, data=None):
        self._queue.put({
            "operation": operation,
            "collection_name": collection_name,
            "data": data
        })

    def cleanup(self):
        pass


class Termination(Exception):
    """
    Exception raised when a Job handles SIGTERM.

    """
    pass


class JobError(Exception):
    """
    Exception raised when a Job encounters and error in a subprocess or stage method."

    """
    pass


def handle_sigterm(*args, **kwargs):
    raise Termination


def handle_exception(max_tb=50, print_message=False):
    # Retrieve exception data from exc_info()
    exception, value, trace_info = sys.exc_info()

    # Exception type: eg. KeyError
    exception = exception.__name__

    # Get the value details
    details = []
    for line in value.args:
        details.append(str(line))

    # Format the traceback data
    trace_info = traceback.format_tb(trace_info, max_tb)

    if print_message:
        for line in trace_info:
            print(line)
        print(exception + ": " + "; ".join(details))

    # Return exception information as dictionary
    return {
        "type": exception,
        "traceback": trace_info,
        "details": details
    }


def write_log(path, log_list):
    try:
        with open(path, "w") as log_file:
            for line in log_list:
                log_file.write(line + "\n")
    except IOError:
        os.makedirs(path)
        write_log(path, log_list)


def stage_method(func):
    """
    A decorator that adds the attribute ``is_stage_method`` to the returned function so it can be recognized as a
    job stage method when the documentation is generated.

    :param func: the function to decorate.
    :type func: function

    :return: the decorated function.
    :rtype: function

    """
    func.is_stage_method = True
    return func
