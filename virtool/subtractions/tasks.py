from tempfile import TemporaryDirectory
from typing import Dict

from virtool.data.layer import DataLayer
from virtool.tasks.task import BaseTask


class AddSubtractionFilesTask(BaseTask):
    """
    Rename Bowtie2 index name from 'reference' to 'subtraction'.

    Add a 'files' field to subtraction documents to list what files can
    be downloaded for that subtraction.

    """

    name = "add_subtraction_files"

    def __init__(self, task_id: int, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.add_subtraction_files]

    async def add_subtraction_files(self):
        """
        Change Bowtie2 index name from 'reference' to 'subtraction' and add any missing
        subtraction files to Postgres.

        """
        await self.data.subtractions.rename_and_track_files(
            self.create_progress_handler()
        )


class CheckSubtractionsFASTATask(BaseTask):
    """
    Write a FASTA file based on a subtraction's existing Bowtie2 index.

    The target subtraction id is provided in the task's context.

    """

    name = "check_subtractions_fasta_file"

    def __init__(
        self, task_id: int, data: DataLayer, context: Dict, temp_dir: TemporaryDirectory
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.subtractions_without_fasta = None

        self.steps = [
            self.check_subtraction_fasta_file,
            self.generate_fasta_file,
        ]

    async def check_subtraction_fasta_file(self):
        """
        Check if a FASTA file for the subtraction already exists.

        """
        self.subtractions_without_fasta = (
            await self.data.subtractions.check_fasta_files()
        )

    async def generate_fasta_file(self):
        for subtraction_id in self.subtractions_without_fasta:
            await self.data.subtractions.generate_fasta_file(subtraction_id)
