import os
import sys
import signal
import traceback
import multiprocessing
import subprocess

from setproctitle import setproctitle
from virtool import utils


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


class Job(multiprocessing.Process):

    def __init__(self, _id, settings, message_queue, task, task_args, proc, mem):
        super(Job, self).__init__()

        # A dictionary of server settings.
        self.settings = settings

        # Used to communicate with the server.
        self.queue = message_queue

        # The job's database _id.
        self._id = _id

        # The task name.
        self.task = task

        self.task_args = task_args
        self.proc = proc
        self.mem = mem
        self.log_list = []

        # If the job owns an external subprocess, the subprocess.Popen object will be referred to by this attribute. If
        # no process is open, the attribute is set to None.
        self.process = None

        self.stage_list = list()
        self.stage_counter = 0
        self.progress = 0
        self.stage_progress = 0

        self.do_cleanup = False

        self.state = "waiting"
        self.stage = None
        self.error = None

    def log(self, line, timestamp=None):
        if timestamp is None:
            timestamp = str(utils.timestamp())

        self.log_list.append(timestamp + "\t" + str(line))

    def run(self):
        # Set the process title so that it is easily identifiable as a virtool job process.
        setproctitle("virtool-" + self._id)

        # Ignore keyboard interrupts. The manager will deal with the signal and cancel jobs safely.
        signal.signal(signal.SIGINT, signal.SIG_IGN)

        # When the manager terminates jobs, run the get_term method.
        signal.signal(signal.SIGTERM, self.handle_sigterm)

        was_cancelled = False
        had_error = False

        try:
            # Tell the database that the job has started running
            self.update_status(state="running")

            try:
                # Run the commands in the command list
                for stage_method in self.stage_list:
                    self.stage_counter += 1
                    self.stage_progress = 0

                    self.progress = round(self.stage_counter / (len(self.stage_list) + 2), 3)

                    # Get the function name and use it to tell the jobs collection that a new stage has been started.
                    self.update_status(stage=stage_method.__name__)

                    # Run the command function
                    stage_method()
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
                    self.error = {
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

            self.do_cleanup = True

            # Terminate any owned subprocess and log the outcome.
            try:
                self.log("Terminated an external subprocess.")
                self.process.terminate()
            except AttributeError:
                self.log("Did not find an external subprocess to terminate.")
                pass

        except JobError:
            # When an error occurs in the job the JobError exception is raised immediately to stop all execution of task
            # code. A message is sent to the job manager detailing the error. In response, the manager calls the Job's
            # terminate method. The SIGTERM is caught and the handle_sigterm method is called to cleanly kill the job.
            had_error = True

            self.update_status(state="error", stage=self.stage, error=self.error)

            try:
                # Wait after the JobError exception while the server gets around to calling the terminate method.
                while True:
                    pass

            except Termination:
                # When it does, the Terminate exception will be raised and we will continue shutting down the job.
                self.do_cleanup = True

        # Clean-up intermediate files and database changes if the job is ending due to cancellation or and error.
        self.log("Cleaning up")
        if self.do_cleanup:
            self.cleanup()

        # Write the job log to file and clear the log data from the database to save memory.
        write_log(self.settings["data_path"] + "/logs/jobs/" + self._id + ".log", self.log_list)

        if was_cancelled:
            self.update_status(state="cancelled")

    def handle_sigterm(self, *args, **kwargs):
        self.log("Got a termination signal. Raising Termination exception. {} {}".format(repr(args), repr(kwargs)))
        raise Termination

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
            self.error = {
                "message": ["Returned " + str(self.process.returncode), "Check log."],
                "context": "External Process Error"
            }

        if no_output_failure and not output:
            self.error = {
                "message": stderr.split("\n"),
                "context": "External Process Error"
            }

        if self.error:
            raise JobError

        # Set the process attribute to None, indicating that there is no running external process.
        self.process = None

        return output

    def update_status(self, state=None, stage=None, error=None):
        """
        Report changes in job state and stage and any errors to the job manager. Any changes are also logged to the job
        log.

        """
        # Set the state and stage attributes if they are changed by this status update.
        self.state = state if state else self.state
        self.stage = stage if stage else self.stage

        # Write to the job log.
        if not error:
            if not state or state != "complete":
                self.log("status_change: State='" + str(self.state) + "', Stage='" + str(self.stage) + "'")
            elif state == "complete":
                self.log("job complete.")
        else:
            self.log("an error occurred")

        # Instruct the manager to update the jobs database collection with the new status information.
        self.collection_operation("jobs", "update_status", {
            "_id": self._id,
            "progress": self.progress + self.stage_progress,
            "state": self.state,
            "stage": self.stage,
            "error": error
        })

    def update_stage_progress(self, stage_progress):
        stage_weight = round(1 / (len(self.stage_list) + 2), 3)

        self.stage_progress = stage_weight * stage_progress
        self.update_status()

    def collection_operation(self, collection_name, operation, data=None):
        self.queue.put({
            "operation": operation,
            "collection_name": collection_name,
            "data": data
        })

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