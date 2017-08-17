import time

import virtool.job


class DummyJob(virtool.job.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.message = self._task_args["message"]

        self.generate_python_error = self._task_args.get("generate_python_error", False)
        self.generate_process_error = self._task_args.get("generate_process_error", False)
        self.long = self._task_args.get("long", False)

        self._stage_list = [
            self.say_message
        ]

    async def say_message(self):
        phrase = self.run_method(self.ext_method, "fred", duration=5)
        print(phrase)

    @staticmethod
    def ext_method(name, duration=5):
        time.sleep(duration)
        return "hello world, my name is " + name
