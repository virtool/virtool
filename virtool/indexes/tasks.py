from typing import TYPE_CHECKING

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    pass


class EnsureIndexFilesTask(BaseTask):
    """
    Add a 'files' field to index documents to list what files can be downloaded for that
    index.
    """

    name = "ensure_index_files"
