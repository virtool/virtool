"""
Work with subtractions in the database.

"""
import asyncio
import glob
import os
import shutil
from typing import Any, Dict

import virtool.db.utils
import virtool.subtractions.utils
import virtool.tasks.task
import virtool.tasks.pg
import virtool.tasks.task
import virtool.utils

from virtool.types import App

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

ADD_SUBTRACTION_FILES_QUERY = {
    "deleted": False,
    "files": {"$exists": False}
}


class AddSubtractionFilesTask(virtool.tasks.task.Task):
    """
    Rename Bowtie2 index name from 'reference' to 'subtraction'.

    Add a 'files' field to subtraction documents to list what files can be downloaded for that subtraction.

    """
    task_type = "add_subtraction_files"

    def __init__(self, app: App, task_id: int):
        super().__init__(app, task_id)

        self.steps = [
            self.rename_index_files,
            self.add_files_field,
        ]

    async def rename_index_files(self):
        """
        Change Bowtie2 index name from 'reference' to 'subtraction'

        """
        settings = self.app["settings"]

        async for subtraction in self.db.subtraction.find(ADD_SUBTRACTION_FILES_QUERY):
            path = virtool.subtractions.utils.join_subtraction_path(settings, subtraction["_id"])
            await self.app["run_in_thread"](virtool.subtractions.utils.rename_bowtie_files, path)

    async def add_files_field(self):
        """
        Add a 'files' field to subtraction documents to list what files can be downloaded for that subtraction

        """
        async for subtraction in self.db.subtraction.find(ADD_SUBTRACTION_FILES_QUERY):
            files = await virtool.subtractions.utils.prepare_files_field(self.pg, subtraction["_id"])
            await self.db.subtraction.update_one({"_id": subtraction["_id"]}, {
                "$set": {
                    "files": files
                }
            })


class WriteSubtractionFASTATask(virtool.tasks.task.Task):
    task_type = "write_subtraction_fasta"

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


async def attach_subtractions(db, document: Dict[str, Any]):
    """
    Attach more subtraction detail to a document with a field `subtractions` that contains a list
    of subtraction IDs.

    :param db: the application database client
    :param document: the document to attach data to
    :return: the updated document
    """
    if document.get("subtractions"):
        subtractions = list()

        for subtraction_id in document["subtractions"]:
            subtraction_name = await virtool.db.utils.get_one_field(
                db.subtraction,
                "name",
                subtraction_id
            )

            subtractions.append({
                "id": subtraction_id,
                "name": subtraction_name
            })

        return {
            **document,
            "subtractions": subtractions
        }

    return document


async def check_subtraction_fasta_files(db, settings: dict) -> list:
    """
    Check subtraction directories for files and set 'has_file' to boolean based on whether .fa.gz exists.

    :param db: the application database client
    :param settings: the application settings
    :return: a list of subtraction IDs without FASTA files

    """
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


async def get_linked_samples(db, subtraction_id):
    cursor = db.samples.find({"subtraction.id": subtraction_id}, ["name"])
    return [virtool.utils.base_processor(d) async for d in cursor]


async def unlink_default_subtractions(db, subtraction_id):
    await db.samples.update_many({"subtractions": subtraction_id}, {
        "$pull": {
            "subtractions": subtraction_id
        }
    })


