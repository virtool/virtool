import time

import virtool.job
import virtool.job_manager


class DummyJob(virtool.job.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.message = self.task_args["message"]
        self.long = self.task_args.get("long", False)
        self.use_executor = self.task_args.get("use_executor", False)
        self.target = self.task_args.get("target", list())
        self.generate_python_error = self.task_args.get("generate_python_error", False)
        self.generate_process_error = self.task_args.get("generate_process_error", False)

        self._stage_list = [
            self.prepare,
            self.say_message,
            self.try_read_stdout
        ]

    @virtool.job.stage_method
    async def prepare(self):
        pass

    @virtool.job.stage_method
    async def say_message(self):
        if self.use_executor:
            result = await self.run_in_executor(ext_dummy_func, self.message, self.long)
        else:
            result = "I didn't run in an executor. My message is " + self.message

        self.target.append(result)

    @virtool.job.stage_method
    async def try_read_stdout(self):
        command = [
            "echo", "hello world"
        ]

        await self.run_subprocess(command, stdout_handler=print)


def ext_dummy_func(message, long):
    phrase = "I ran in an executor. My message is " + message

    if long:
        time.sleep(2)

    return phrase
