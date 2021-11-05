import asyncio
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.subtractions.files
import virtool.subtractions.utils
import virtool.tasks.pg
import virtool.tasks.task
import virtool.utils

from virtool.subtractions.db import ADD_SUBTRACTION_FILES_QUERY
from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.utils import FILES
from virtool.types import App


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
        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            step="rename_index_files"
        )

        async for subtraction in self.db.subtraction.find(ADD_SUBTRACTION_FILES_QUERY):
            path = virtool.subtractions.utils.join_subtraction_path(self.app["config"], subtraction["_id"])
            await self.app["run_in_thread"](virtool.subtractions.utils.rename_bowtie_files, path)

    async def store_subtraction_files(self):
        """
        Add a 'files' field to subtraction documents to list what files can be downloaded for that
        subtraction

        """
        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            step="store_subtraction_files"
        )

        async for subtraction in self.db.subtraction.find(ADD_SUBTRACTION_FILES_QUERY):
            path = virtool.subtractions.utils.join_subtraction_path(self.app["config"], subtraction["_id"])
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
        config = self.app["config"]
        subtraction = self.context["subtraction"]

        index_path = virtool.subtractions.utils.join_subtraction_index_path(config, subtraction)
        fasta_path = (
            virtool.subtractions.utils.join_subtraction_path(config, subtraction)
            / "subtraction.fa"
        )

        command = f'bowtie2-inspect {index_path} > {fasta_path}'

        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE)

        await proc.communicate()

        target_path = (
            virtool.subtractions.utils.join_subtraction_path(config, subtraction)
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
