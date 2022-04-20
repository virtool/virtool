import string

from faker.providers import BaseProvider

ID_CHARACTERS = string.ascii_lowercase + string.digits

WORKFLOW_NAMES = [
    "aodp",
    "build_index",
    "create_sample",
    "create_subtraction",
    "nuvs",
    "pathoscope",
]

WORKFLOW_STATES = ["waiting", "preparing", "running", "cancelled", "complete"]

WORKFLOW_STATUS = [
    {"state": "cancelled", "stage": "first"},
    {"state": "complete", "stage": "first"},
    {"state": "running", "stage": "second"},
]


class JobsProvider(BaseProvider):
    def workflow(self):
        return self.random_element(WORKFLOW_NAMES)

    def job_state(self):
        return self.random_element(WORKFLOW_STATES)

    def job_status(self):
        return [
            {"state": "waiting", "stage": None},
            {"state": "preparing", "stage": None},
            {"state": "running", "stage": "first"},
            self.random_element(WORKFLOW_STATUS),
        ]


class MongoIDProvider(BaseProvider):
    def mongo_id(self):
        return "".join(self.random_choices(ID_CHARACTERS, length=8))
