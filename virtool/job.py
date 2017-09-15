import os
import sys
import asyncio
import pymongo
import inspect
import traceback

import virtool.utils


LIST_PROJECTION = [
    "_id",
    "task",
    "status",
    "proc",
    "mem",
    "user"
]


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
    document = virtool.utils.base_processor(document)

    status = document.pop("status")

    last_update = status[-1]

    document.update({
        "state": last_update["state"],
        "stage": last_update["stage"],
        "created_at": status[0]["timestamp"],
        "progress": status[-1]["progress"]
    })

    return document


class Job:

    def __init__(self, loop, executor, db, settings, dispatch, job_id, task_name, task_args, proc, mem):
        self.loop = loop
        self.executor = executor
        self.db = db
        self.settings = settings
        self.dispatch = dispatch
        self.id = job_id
        self.task_name = task_name
        self.task_args = task_args
        self.proc = proc
        self.mem = mem

        self.started = False
        self.finished = False

        self._progress = 0
        self._state = "waiting"
        self._stage = None
        self._error = None
        self._cancelled = False
        self._task = None
        self._process_task = None
        self._stage_list = None
        self._log_path = os.path.join(self.settings.get("data_path"), "logs", "jobs", self.id)
        self._log_buffer = list()

    def start(self):
        self._task = self.loop.create_task(self.run())
        self.started = True

    async def run(self):
        for method in self._stage_list:
            name = method.__name__

            await self.add_status(stage=name, state="running")

            try:
                await self.add_log("Stage: {}".format(name))
                await method()
            except asyncio.CancelledError:
                self._cancelled = True
            except:
                self._error = handle_exception()

            if self._error or self._cancelled:
                break

        self._progress = 1

        if self._error:
            await self.add_status(state="error")
            await self.cleanup()
        elif self._cancelled:
            await self.add_status(state="cancelled")
            await self.cleanup()
        else:
            await self.add_status(state="complete")

        await self.run_in_executor(flush_log, self._log_path, self._log_buffer)

        self.finished = True

    async def run_in_executor(self, func, *args):
        await self.add_log("Process: {}".format(func.__name__))
        self._process_task = self.loop.run_in_executor(self.executor, func, *args)
        result = await self._process_task
        self._process_task = None

        return result

    async def run_subprocess(self, command, stdout_handler=None, stderr_handler=None, env=None):
        await self.add_log("Command: {}".format(" ".join(command)))

        _stdout_handler = None

        if stdout_handler:
            stdout = asyncio.subprocess.PIPE

            if not inspect.iscoroutinefunction(stdout_handler):
                async def _stdout_handler(line):
                    return stdout_handler(line)
            else:
                _stdout_handler = stdout_handler
        else:
            stdout = asyncio.subprocess.DEVNULL

        stderr = asyncio.subprocess.PIPE

        if stderr_handler:
            if not inspect.iscoroutinefunction(stderr_handler):
                async def arg_stderr_handler(line):
                    await self.add_log(line)
                    return stderr_handler(line)
            else:
                arg_stderr_handler = stderr_handler

            async def _stderr_handler(line):
                await arg_stderr_handler(line)
                await self.add_log(line, indent=1)
        else:
            async def _stderr_handler(line):
                await self.add_log(line, indent=1)

        child_watcher = asyncio.get_child_watcher()
        child_watcher.attach_loop(self.loop)

        proc = await asyncio.create_subprocess_exec(
            *command,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            loop=self.loop,
            env=env
        )

        waits = [read_stream(proc.stderr, _stderr_handler)]

        if _stdout_handler:
            waits.append(read_stream(proc.stdout, _stdout_handler))

        await asyncio.wait(waits)

        await proc.wait()

        if proc.returncode != 0:
            raise SubprocessError("Command failed: {}. Check job log.".format(" ".join(command)))

    async def add_status(self, state=None, stage=None):
        self._state = state or self._state
        self._stage = stage or self._stage

        if self._progress != 1:
            stage_index = [m.__name__ for m in self._stage_list].index(self._stage)
            self._progress = round((stage_index + 1) / (len(self._stage_list) + 1), 2)

        document = await self.db.jobs.find_one_and_update({"_id": self.id}, {
            "$push": {
                "status": {
                    "state": self._state,
                    "stage": self._stage,
                    "error": self._error,
                    "progress": self._progress,
                    "timestamp": virtool.utils.timestamp()
                }
            }
        }, return_document=pymongo.ReturnDocument.AFTER, projection=LIST_PROJECTION)

        await self.dispatch("jobs", "update", dispatch_processor(document))

    async def add_log(self, line, indent=0):
        timestamp = virtool.utils.timestamp().isoformat()

        self._log_buffer.append("{}{}    {}".format(timestamp, " " * indent * 4, line.rstrip()))

        if len(self._log_buffer) == 15:
            await self.flush_log()
            del self._log_buffer[:]

    async def flush_log(self):
        await self.run_in_executor(flush_log, self._log_path, self._log_buffer)

    async def cancel(self):
        if self.started and not self.finished:
            self._task.cancel()

            while not self.finished:
                await asyncio.sleep(0.1, loop=self.loop)

        await self.cleanup()

        self.finished = True

    async def cleanup(self):
        pass


def stage_method(func):
    func.is_stage_method = True
    return func


async def read_stream(stream, cb):
    while True:
        line = await stream.readline()

        if line:
            await cb(line)
        else:
            break


def flush_log(path, buffer):
    with open(path, "a") as handle:
        handle.write("\n".join(buffer))


def handle_exception(max_tb=50):
    exception, value, trace_info = sys.exc_info()

    return {
        "type": exception.__name__,
        "traceback": traceback.format_tb(trace_info, max_tb),
        "details": [str(l) for l in value.args]
    }


class SubprocessError(Exception):
    pass
