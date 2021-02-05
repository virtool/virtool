"""
Work with subtractions in the database.

Schema:
- _id (str) the unique ID for the subtraction
- count (int) the number of sequences in the subtraction reference (ie. FASTA entry count)
- deleted (bool) subtractions aren't truly deleted; this flag is set to true
- file (Object) a description of the source file for the subtraction
  - id (str) the unique ID for the file
  - name (str) the name of the uploaded file
- gc (float) the GC ratio of the subtraction
- is_host (bool) true when the subtraction is a virus host - currently always true
- job (str) the ID of the job associated with creation of the subtraction
- name (str) the user-defined name
- nickname (str) the user-defined nickname for the subtraction
- ready (bool) true when the subtraction creation workflow is complete
- user (Object) describes the creating user
  - id (str) the ID of the user

"""
import asyncio
import glob
import os
import shutil

import virtool.db.utils
import virtool.subtractions.utils
import virtool.tasks.task
import virtool.tasks.pg
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


class WriteSubtractionFASTATask(virtool.tasks.task.Task):

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [
            self.generate_fasta_file,
        ]

    async def generate_fasta_file(self):
        settings = self.app["settings"]
        subtraction = self.context["subtraction"]

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

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            progress=100,
            step="generate_fasta_file"
        )


async def check_subtraction_fasta_files(db, settings):
    subtractions_without_fasta = list()

    async for subtraction in db.subtraction.find({"deleted": False}):
        path = virtool.subtractions.utils.join_subtraction_path(settings, subtraction["_id"])
        has_file = True

        if not glob.glob(f'{path}/*.fa.gz'):
            has_file = False
            subtractions_without_fasta.append(subtraction["_id"])

        await db.subtraction.find_one_and_update({"_id": subtraction["_id"]}, {
            "$set": {
                "has_file": has_file
            }
        })

    return subtractions_without_fasta


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
