"""
Work with subtractions in the database.

"""
import asyncio
import glob
import os
import shutil
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.db.utils
import virtool.subtractions.files
import virtool.subtractions.utils
import virtool.tasks.pg
import virtool.tasks.task
import virtool.tasks.task
import virtool.utils
from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.utils import FILES
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
    "deleted": False
}


async def attach_computed(app: App, subtraction: Dict[str, Any]) -> Dict[str, Any]:
    """
    Attach the ``linked_samples`` and ``files`` fields to the passed subtraction document.

    Queries MongoDB and SQL to find the required data. Returns a new document dictionary.

    :param app: the application object
    :param subtraction: the subtraction document to attach to
    :return: a new subtraction document with new fields attached

    """
    subtraction_id = subtraction["_id"]

    files, linked_samples = await asyncio.gather(
        virtool.subtractions.utils.get_subtraction_files(app["pg"], subtraction_id),
        virtool.subtractions.db.get_linked_samples(app["db"], subtraction_id)
    )

    return {
        **subtraction,
        "files": files,
        "linked_samples": linked_samples
    }


class AddSubtractionFilesTask(virtool.tasks.task.Task):
    """
    Rename Bowtie2 index name from 'reference' to 'subtraction'.

    Add a 'files' field to subtraction documents to list what files can be downloaded for that
    subtraction.

    """
    task_type = "add_subtraction_files"

    def __init__(self, app: App, task_id: int):
        super().__init__(app, task_id)

        self.steps = [
            self.rename_index_files,
            self.store_subtraction_files,
        ]

    async def rename_index_files(self):
        """
        Change Bowtie2 index name from 'reference' to 'subtraction'

        """
        settings = self.app["settings"]

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            step="rename_index_files"
        )

        async for subtraction in self.db.subtraction.find(ADD_SUBTRACTION_FILES_QUERY):
            path = virtool.subtractions.utils.join_subtraction_path(settings, subtraction["_id"])
            await self.app["run_in_thread"](virtool.subtractions.utils.rename_bowtie_files, path)

    async def store_subtraction_files(self):
        """
        Add a 'files' field to subtraction documents to list what files can be downloaded for that
        subtraction

        """
        settings = self.app["settings"]

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            step="store_subtraction_files"
        )

        async for subtraction in self.db.subtraction.find(ADD_SUBTRACTION_FILES_QUERY):
            path = virtool.subtractions.utils.join_subtraction_path(settings, subtraction["_id"])
            subtraction_files = list()

            for filename in sorted(os.listdir(path)):
                if filename in FILES:
                    async with AsyncSession(self.app["pg"]) as session:
                        exists = (await session.execute(
                            select(SubtractionFile).filter_by(
                                subtraction=subtraction["_id"],
                                name=filename
                            )
                        )).scalar()

                    if not exists:
                        subtraction_files.append(filename)

            await virtool.subtractions.files.create_subtraction_files(
                self.app["pg"],
                subtraction["_id"],
                subtraction_files,
                path
            )


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
        fasta_path = (
            virtool.subtractions.utils.join_subtraction_path(settings, subtraction)
            / "subtraction.fa"
        )

        command = f'bowtie2-inspect {index_path} > {fasta_path}'

        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE)

        await proc.communicate()

        target_path = (
            virtool.subtractions.utils.join_subtraction_path(settings, subtraction)
            / "subtraction.fa.gz"
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


async def attach_subtractions(db, document: Dict[str, Any]) -> Dict[str, Any]:
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
    Check subtraction directories for files and set 'has_file' to boolean based on whether .fa.gz
    exists.

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


async def create(
        db,
        user_id: str,
        filename: str,
        name: str,
        nickname: str,
        upload_id: int,
        subtraction_id: Optional[str] = None,
) -> dict:
    """
    Create a new subtraction document.

    :param db: the application database client
    :param user_id: the id of the current user
    :param filename: the name of the `subtraction_file`
    :param name: the name of the subtraction
    :param nickname: the nickname of the subtraction
    :param upload_id: the id of the `subtraction_file`
    :param subtraction_id: the id of the subtraction

    :return: the new document

    """
    document = {
        "_id": subtraction_id or await virtool.db.utils.get_new_id(db.subtraction),
        "name": name,
        "nickname": nickname,
        "deleted": False,
        "ready": False,
        "is_host": True,
        "file": {
            "id": upload_id,
            "name": filename
        },
        "user": {
            "id": user_id
        }
    }

    await db.subtraction.insert_one(document)

    return document


async def delete(app: App, subtraction_id: str) -> int:
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


async def finalize(db, pg: AsyncEngine, subtraction_id: str, gc: Dict[str, float]) -> dict:
    """
    Finalize a subtraction by setting `ready` to True and updating the `gc` and `files` fields.

    :param db: the application database client
    :param pg: the PostgreSQL AsyncEngine object
    :param subtraction_id: the id of the subtraction
    :param gc: a dict contains gc data
    :return: the updated subtraction document

    """
    updated_document = await db.subtraction.find_one_and_update({"_id": subtraction_id}, {
        "$set": {
            "gc": gc,
            "ready": True
        }
    })

    return updated_document


async def get_linked_samples(db, subtraction_id: str) -> List[dict]:
    """
    Find all samples containing given 'subtraction_id' in 'subtractions' field.

    :param db: the application database client
    :param subtraction_id: the ID of the subtraction
    :return: a list of dicts containing linked samples with 'id' and 'name' field.

    """
    cursor = db.samples.find({"subtractions": subtraction_id}, ["_id", "name"])
    return [virtool.utils.base_processor(d) async for d in cursor]


async def unlink_default_subtractions(db, subtraction_id: str):
    await db.samples.update_many({"subtractions": subtraction_id}, {
        "$pull": {
            "subtractions": subtraction_id
        }
    })
