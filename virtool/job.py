import os
import sys
import signal
import pymongo
import traceback
import multiprocessing
import subprocess
import setproctitle

import virtool.utils


LIST_PROJECTION = [
    "_id",
    "task",
    "status",
    "proc",
    "mem",
    "user"
]


def processor(document):
    """
    Process a job document for transmission to a client.

    :param document: a job document
    :type document: dict
    
    :return: a processed job document
    :rtype: dict
    
    """
    return virtool.utils.base_processor(document)


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
    document = processor(document)

    status = document.pop("status")

    last_update = status[-1]

    document.update({
        "state": last_update["state"],
        "stage": last_update["stage"],
        "created_at": status[0]["timestamp"],
        "progress": status[-1]["progress"]
    })

    return document


class Job():

    def __init__(self, job_id, settings, task, task_args, proc, mem):
        super().__init__()

        #: The job's database id.
        self.id = job_id

        #: A dict of server settings.
        self._settings = settings

        #: The task name.
        self.task = task

        #: The task args passed from the :meth:`.jobs.Collection.new` method.
        self.task_args = task_args

        #: The number of cores the job is allowed to use.
        self.proc = proc

        #: The amount of memory in GB that the job is allowed to use.
        self.mem = mem

        self._stage_list = list()

        self.stage_counter = 0
        self.progress = 0

        self._do_cleanup = False

        self._state = "waiting"
        self._stage = None
        self._error = None

    def run(self):

        was_cancelled = False
        had_error = False

        try:
            # Tell the database that the job has started running
            self.update_status(state="running")

            try:
                # Run the commands in the command list
                for method in self._stage_list:
                    self.stage_counter += 1

                    self.progress = round(self.stage_counter / (len(self._stage_list) + 1), 2)

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
            self.progress = 1
            self.update_status(state="complete", stage=None)

        if had_error or was_cancelled:
            self.progress = 1

            # Terminate any owned subprocess and log the outcome.
            try:
                self._process.terminate()
            except AttributeError:
                pass

            self.cleanup()

        if was_cancelled:
            self.update_status(state="cancelled")

        if had_error:
            self.update_status(state="error", stage=self._stage, error=self._error)


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
            with subprocess.Popen(
                    cmd,
                    stdout=stdout_handle,
                    stderr=subprocess.PIPE,
                    env=env,
                    universal_newlines=True
            ) as process:
                
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
        self.call_static("add_status", self._job_id, self.progress, self._state, self._stage, error)

    def cleanup(self):
        pass


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
