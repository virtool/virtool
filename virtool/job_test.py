import time
import pprint

import virtool.job


class TestTask(virtool.job.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.message = self._task_args["message"]

        self.generate_python_error = self._task_args.get("generate_python_error", False)
        self.generate_process_error = self._task_args.get("generate_process_error", False)
        self.long = self._task_args.get("long", False)

        self._stage_list = [
            self.say_message,
            self.do_db_op
        ]

    def say_message(self):
        self.call_static("pass_message", self.message)

        if self.long:
            time.sleep(5)

        if self.generate_python_error:
            # This will cause a Python error
            print("pass_message", 1 + "2")

        if self.generate_process_error:
            out = self.run_process(["ls", "/this/path/should/not/exist"])
            print(out)

    def do_db_op(self):
        self.db.job_test.insert({"message": self.message})

    @staticmethod
    def pass_message(manager, message):
        pprint.pprint(message)
