import virtool.db.processes

FIRST_STEPS = {
    "delete_reference": "delete_indexes",
    "clone_reference": "copy_otus",
    "import_reference": "load_file",
    "remote_reference": "download",
    "update_software": "",
    "install_hmms": ""
}

UNIQUES = [
    "update_software",
    "install_hmms"
]


class ProgressTracker:

    def __init__(self, db, process_id, total, factor=1, increment=0.05, initial=0):
        self.db = db
        self.process_id = process_id
        self.total = total
        self.factor = factor
        self.increment = increment
        self.initial = initial

        self.count = 0
        self.last_reported = 0
        self.progress = self.initial

    async def add(self, value):
        count = self.count + value

        if count > self.total:
            raise ValueError("Count cannot exceed total")

        self.count = count

        self.progress = self.initial + round(self.count / self.total * self.factor, 2)

        if self.progress - self.last_reported >= self.increment:
            await virtool.db.processes.update(self.db, self.process_id, progress=self.progress)
            self.last_reported = self.progress

        return self.progress
