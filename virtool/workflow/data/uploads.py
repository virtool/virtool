from dataclasses import dataclass
from pathlib import Path

from pyfixtures import fixture

from virtool.workflow.client import WorkflowAPIClient


@dataclass
class WFUploads:
    def __init__(self, api: WorkflowAPIClient):
        self._api = api

    async def download(self, upload_id: int, path: Path) -> None:
        """Download the upload with the given ID to the given path."""
        await self._api.get_file(f"/uploads/{upload_id}", path)


@fixture
async def uploads(_api: WorkflowAPIClient) -> WFUploads:
    """Provides access to files that have been uploaded to the Virtool instance.

    Files can be downloaded into the workflow environment be calling
    :meth:`.WFUploads.download`.

    Example:
    -------
    .. code-block:: python

        @step
        async def step_one(uploads: WFUploads, work_path: Path):
            await uploads.download(1, work_path / "file.txt")

    """
    return WFUploads(_api)
