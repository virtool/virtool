import os
import sys
import signal
import traceback
import multiprocessing
import subprocess
import threading
import queue

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

    def run_process(self, command, stdout_handler=None, stderr_handler=None, dont_log_stdout=True, env=None):
        """
        Wraps :class:`subprocess.POpen`. Takes a command (list) that is run with all output be cleanly handled in
        real time. Also takes handler methods for stdout and stderr lines. These will be called anytime new output is
        available and be passed the line. If the process encounters an error as identified by the return code, it is
        handled just like a Python error.

        """
        self.process = Process(command, env=env)

        # Keep checking for output until the process is closed (all output read and process complete).
        while not self.process.closed:
            out, err = self.process.stdout.read(), self.process.stderr.read()

            # If there is data from stdout and/or stderr, log it and pass it to a handler if a handler is defined.
            if out is not None:
                if not dont_log_stdout:
                    self.log(out["data"], out["timestamp"])
                if stdout_handler:
                    stdout_handler(out)

            if err is not None:
                self.log(err["data"], err["timestamp"])
                if stderr_handler:
                    stderr_handler(err)

        # When the return code is not zero, the process encountered an error. Handle this error, triggering a status
        # update and termination of the job.
        if self.process.returncode not in [0, None]:
            self.error = {
                "message": ["Returned " + str(self.process.returncode), "Check log."],
                "context": "External Process Error"
            }

            raise JobError

        # Set the process attribute to None, indicating that there is no running external process.
        self.process = None

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


class Process:

    def __init__(self, command, env=None):
        self.p = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)

        self.stdout = Output(self.p, self.p.stdout)
        self.stderr = Output(self.p, self.p.stderr)

    @property
    def closed(self):
        """ Returns True when the process is complete and all output has been read. Exposed as a property. """
        return self.stdout.closed and self.stderr.closed

    @property
    def returncode(self):
        self.p.poll()
        return self.p.returncode


class Output:

    def __init__(self, process, pipe):
        self.process = process
        self.pipe = pipe

        # Set to False when the process producing output has a returncode.
        self.process_is_alive = True

        # Set to True when the process producing output is complete and all output has been read from the queue.
        self.closed = False

        # A queue that all output is put into until the process is complete.
        self.output_queue = queue.Queue()

        # Make a Thread object that will run the looping _check method. Start it.
        self.check_thread = threading.Thread(target=self._check)
        self.check_thread.start()

    def _check(self):
        """
        This loop reads the pipe and puts each line into the output_queue. This method is intended to be run in a
        separate thread of control as it blocks continually.

        """
        for raw in self.pipe:
            self.output_queue.put({
                "timestamp": str(utils.timestamp()),
                "data": raw.rstrip().decode()
            })

        # This is set to False when the process has a returncode (ie. it is complete)
        self.process_is_alive = False

    def read(self):
        """ Return the next item in the output_queue. If the queue is empty, return None. """
        try:
            line = self.output_queue.get(block=False)
        except queue.Empty:
            line = None

        if not self.process_is_alive and self.output_queue.empty():
            self.closed = True

        return line


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
