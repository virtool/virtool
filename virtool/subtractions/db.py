"""
Work with subtractions in the database.

"""
import asyncio
import glob
import os
import shutil

import virtool.db.utils
import virtool.subtractions.utils
import virtool.tasks.db
import virtool.tasks.task
import virtool.utils

PROJECTION = [
    "_id",
    "count",
    "file",
    "ready",
    "job",
    "name",
    "nickname",
    "user",
    "has_file"
]

FILES = (
    "subtraction.fa.gz",
    "subtraction.1.bt2",
    "subtraction.2.bt2",
    "subtraction.3.bt2",
    "subtraction.4.bt2",
    "subtraction.rev.1.bt2",
    "subtraction.rev.2.bt2"
)


class AddSubtractionFilesTask(virtool.tasks.task.Task):

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [
            self.rename_index_files,
            self.add_files_field,
        ]

    async def rename_index_files(self):
        settings = self.app["settings"]

        async for subtraction in self.db.subtraction.find({"deleted": False, "files": {"$exists": False}}):
            path = virtool.subtractions.utils.join_subtraction_path(settings, subtraction["_id"])
            for file in os.listdir(path):
                if file.endswith(".bt2"):
                    file_path = os.path.join(path, file)
                    os.rename(file_path, file_path.replace("reference", "subtraction"))

    async def add_files_field(self):
        settings = self.app["settings"]

        async for subtraction in self.db.subtraction.find({"deleted": False, "files": {"$exists": False}}):
            path = virtool.subtractions.utils.join_subtraction_path(settings, subtraction["_id"])
            files = list()

            for file in os.listdir(path):
                if file in FILES:
                    file_path = os.path.join(path, file)
                    document = {
                        "size": virtool.utils.file_stats(file_path)["size"],
                        "name": file
                    }

                    if file.endswith(".fa.gz"):
                        document["type"] = "fasta"
                    if file.endswith(".bt2"):
                        document["type"] = "reference"

                    files.append(document)

            await self.db.subtraction.update_one({"_id": subtraction["_id"]}, {
                "$set": {
                    "files": files
                }
            })


class WriteSubtractionFASTATask(virtool.tasks.task.Task):

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [
            self.check_subtraction_fasta_files,
            self.generate_fasta_files,
        ]

        self.subtractions_without_fasta = []

    async def check_subtraction_fasta_files(self):
        db = self.db
        settings = self.app["settings"]

        async for subtraction in db.subtraction.find({"deleted": False}):
            path = virtool.subtractions.utils.join_subtraction_path(settings, subtraction["_id"])
            has_file = True

            if not glob.glob(f'{path}/*.fa.gz'):
                has_file = False
                self.subtractions_without_fasta.append(subtraction["_id"])

            await db.subtraction.find_one_and_update({"_id": subtraction["_id"]}, {
                "$set": {
                    "has_file": has_file
                }
            })

        await virtool.tasks.db.update(
            self.db,
            self.id,
            progress=0.2,
        )

    async def generate_fasta_files(self):
        settings = self.app["settings"]

        tracker = self.get_tracker(len(self.subtractions_without_fasta))

        for subtraction in self.subtractions_without_fasta:
            index_path = virtool.subtractions.utils.join_subtraction_index_path(settings, subtraction)
            fasta_path = os.path.join(
                virtool.subtractions.utils.join_subtraction_path(settings, subtraction),
                "subtraction.fa"
            )

            command = f'bowtie2-inspect {index_path} > {fasta_path}'

            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE)

            await proc.communicate()

            target_path = os.path.join(
                virtool.subtractions.utils.join_subtraction_path(settings, subtraction),
                "subtraction.fa.gz"
            )

            await self.run_in_thread(virtool.utils.compress_file,
                                     fasta_path,
                                     target_path)

            virtool.utils.rm(fasta_path)

            await self.db.subtraction.find_one_and_update({"_id": subtraction}, {
                "$set": {
                    "has_file": True
                }
            })

            await tracker.add(1)


async def attach_subtraction(db, document: dict):
    if document.get("subtraction"):
        document["subtraction"]["name"] = await virtool.db.utils.get_one_field(
            db.subtraction,
            "name",
            document["subtraction"]["id"]
        )


async def get_linked_samples(db, subtraction_id):
    cursor = db.samples.find({"subtraction.id": subtraction_id}, ["name"])
    return [virtool.utils.base_processor(d) async for d in cursor]


async def unlink_default_subtractions(db, subtraction_id):
    await db.samples.update_many({"subtraction.id": subtraction_id}, {
        "$set": {
            "subtraction": None
        }
    })


async def delete(app, subtraction_id):
    db = app["db"]
    settings = app["settings"]

    update_result = await db.subtraction.update_one({"_id": subtraction_id, "deleted": False}, {
        "$set": {
            "deleted": True
        }
    })

    await unlink_default_subtractions(db, subtraction_id)

    if update_result.modified_count:
        path = virtool.subtractions.utils.join_subtraction_path(settings, subtraction_id)
        await app["run_in_thread"](shutil.rmtree, path, True)

    return update_result.modified_count
