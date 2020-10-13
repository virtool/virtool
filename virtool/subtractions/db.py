import asyncio
import os
import shutil

import virtool.db.utils
import virtool.subtractions.utils
import virtool.tasks.task
import virtool.tasks.db
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


class CreateSubtractionTask(virtool.tasks.task.Task):

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [
            self.generate_fasta,
            self.compress_file,
            self.update_db
        ]

    async def generate_fasta(self):
        path = self.context["path"]
        index_path = os.path.join(path, "reference")
        target_path = os.path.join(path, "subtraction.fa")

        command = f'bowtie2-inspect {index_path} > {target_path}'

        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE)

        await proc.communicate()

        await virtool.tasks.db.update(
            self.db,
            self.id,
            progress=0.4,
        )

    async def compress_file(self):
        path = self.context["path"]
        file_path = os.path.join(path, "subtraction.fa")
        target_path = os.path.join(path, "subtraction.fa.gz")

        await self.run_in_thread(virtool.utils.compress_file,
                                 file_path,
                                 target_path)

        virtool.utils.rm(file_path)

        await virtool.tasks.db.update(
            self.db,
            self.id,
            progress=0.8,
        )

    async def update_db(self):
        subtraction_id = self.context["subtraction_id"]

        await self.db.subtraction.find_one_and_update({"_id": subtraction_id}, {
            "$set": {
                "has_file": True
            }
        })


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
