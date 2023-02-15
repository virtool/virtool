import string

from faker.providers import BaseProvider
from faker.providers.python import Provider
from virtool_core.models.job import JobState

ID_CHARACTERS = string.ascii_lowercase + string.digits

WORKFLOW_NAMES = [
    "aodp",
    "build_index",
    "create_sample",
    "create_subtraction",
    "nuvs",
    "pathoscope",
]

WORKFLOW_STATUS = [
    {"state": JobState.CANCELLED, "stage": "first"},
    {"state": JobState.COMPLETE, "stage": "first"},
    {"state": JobState.RUNNING, "stage": "second"},
]


class JobsProvider(Provider):
    def workflow(self):
        return self.random_element(WORKFLOW_NAMES)

    def job_state(self):
        return self.random_element(JobState)

    def job_status(self):
        return [
            {"state": JobState.WAITING, "stage": None},
            {"state": JobState.PREPARING, "stage": None},
            {"state": JobState.RUNNING, "stage": "first"},
            self.random_element(WORKFLOW_STATUS),
        ]

    def archive(self):
        return self.pybool()


class MongoIDProvider(BaseProvider):
    def mongo_id(self):
        return "".join(self.random_choices(ID_CHARACTERS, length=8))
