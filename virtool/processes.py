STEP_COUNTS = {
    "delete_reference": 2,
    "import_reference": 0,
    "setup_remote_reference": 0,
    "update_remote_reference": 0,
    "update_software": 0,
    "install_hmms": 0
}

FIRST_STEPS = {
    "delete_reference": "delete_indexes",
    "import_reference": "load_file",
    "setup_remote_reference": "",
    "update_remote_reference": "",
    "update_software": "",
    "install_hmms": ""
}

UNIQUES = [
    "update_software",
    "install_hmms"
]


class ProgressTracker:

    def __init__(self, total, db=None, increment=0.05, factor=1):
        self.total = total
        self.db = db
        self.increment = increment
        self.factor = factor

        self.count = 0
        self.last_reported = 0

    def add(self, value):
        count = self.count + value

        if count > self.total:
            raise ValueError("Count cannot exceed total")

        self.count = count

        return self.progress

    async def reported(self):
        self.last_reported = self.progress

    @property
    def progress(self):
        return round(self.count / self.total, 2)
