import asyncio
import inspect
import os
import sys
import traceback

import aiofiles

import virtool.db.jobs
import virtool.errors
import virtool.utils


class Job:

    def __init__(self, loop, executor, db, settings, capture_exception, job_id, task_name, task_args, proc, mem):
        self.loop = loop
        self.db = db
        self.settings = settings
        self.capture_exception = capture_exception
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

        await self.flush_log()

        self.finished = True

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

        try:
            asyncio.get_child_watcher().attach_loop(self.loop)
        except NotImplementedError:
            pass

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
            raise virtool.errors.SubprocessError("Command failed: {}. Check job log.".format(" ".join(command)))

    async def add_status(self, state=None, stage=None):
        self._state = state or self._state
        self._stage = stage or self._stage

        if self._stage and self._progress != 1:
            stage_index = [m.__name__ for m in self._stage_list].index(self._stage)
            self._progress = round((stage_index + 1) / (len(self._stage_list) + 1), 2)

        await self.db.jobs.update_one({"_id": self.id}, {
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

    async def add_log(self, line, indent=0):
        timestamp = virtool.utils.timestamp().isoformat()

        self._log_buffer.append("{}{}    {}".format(timestamp, " " * indent * 4, line.rstrip()))

        if len(self._log_buffer) == 15:
            await self.flush_log()
            del self._log_buffer[:]

    async def flush_log(self):
        async with aiofiles.open(self._log_path, "a") as f:
            await f.write("\n".join(self._log_buffer))

    async def cancel(self):
        if self.started and not self.finished:
            self._task.cancel()

            while not self.finished:
                await asyncio.sleep(0.1, loop=self.loop)

        elif not self.started:
            self._progress = 1
            await self.add_status(state="cancelled")
            await self.cleanup()
            self.finished = True

    async def cleanup(self):
        pass


def handle_exception(max_tb=50):
    exception, value, trace_info = sys.exc_info()

    return {
        "type": exception.__name__,
        "traceback": traceback.format_tb(trace_info, max_tb),
        "details": [str(l) for l in value.args]
    }


async def read_stream(stream, cb):
    while True:
        line = await stream.readline()

        if line:
            await cb(line)
        else:
            break


def stage_method(func):
    func.is_stage_method = True
    return func
