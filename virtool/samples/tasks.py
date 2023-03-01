import logging

from virtool.tasks.task import BaseTask

logger = logging.getLogger(__name__)


class CompressSamplesTask(BaseTask):
    """
    Compress the legacy FASTQ files for all uncompressed samples.

    """

    name = "compress_samples"

    def __init__(self, task_id, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)
        self.steps = [self.compress_samples]

    async def compress_samples(self):
        await self.data.samples.compress_samples(self.create_progress_handler())


class MoveSampleFilesTask(BaseTask):
    """
    Move pre-SQL samples' file information to new `sample_reads` and `uploads` tables.

    """

    name = "move_sample_files"

    def __init__(self, task_id, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)
        self.steps = [self.move_sample_files]

    async def move_sample_files(self):
        await self.data.samples.move_sample_files(self.create_progress_handler())


class DeduplicateSampleNamesTask(BaseTask):
    """
    Deduplicate sample names in the database. Will append a numbers to the end of the sample name
    in order of sample creation if duplicates are found.
    """

    name = "deduplicate_sample_names"

    def __init__(self, task_id, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)
        self.steps = [self.deduplicate_sample_names]

    async def deduplicate_sample_names(self):
        await self.data.samples.deduplicate_sample_names()
