FIRST_STEPS = {
    "delete_reference": "delete_indexes",
    "clone_reference": "copy_otus",
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

    def reported(self):
        self.last_reported = self.progress

    @property
    def progress(self):
        return round(self.count / self.total * self.factor, 2)
