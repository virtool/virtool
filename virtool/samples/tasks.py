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
