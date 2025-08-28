from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import aiofiles
from aiohttp import BasicAuth, ClientSession
from structlog import get_logger

from virtool.workflow.api import (
    decode_json_response,
    raise_exception_by_status_code,
    retry,
)
from virtool.workflow.errors import JobsAPIError
from virtool.workflow.files import VirtoolFileFormat

logger = get_logger("http")

API_CHUNK_SIZE = 1024 * 1024 * 2
"""The size of chunks to use when downloading files from the API in bytes."""


class WorkflowAPIClient:
    def __init__(self, http: ClientSession, jobs_api_connection_string: str):
        self.http = http
        self.jobs_api_connection_string = jobs_api_connection_string

    @retry
    async def get_json(self, path: str) -> dict:
        """Get the JSON response from the provided API ``path``."""
        async with self.http.get(f"{self.jobs_api_connection_string}{path}") as resp:
            await raise_exception_by_status_code(resp)
            return await decode_json_response(resp)

    @retry
    async def get_file(self, path: str, target_path: Path):
        """Download the file at URL ``path`` to the local ``target_path``."""
        async with self.http.get(f"{self.jobs_api_connection_string}{path}") as resp:
            if resp.status != 200:
                raise JobsAPIError(
                    f"Encountered {resp.status} while downloading '{path}'",
                )

            async with aiofiles.open(target_path, "wb") as f:
                async for chunk in resp.content.iter_chunked(API_CHUNK_SIZE):
                    await f.write(chunk)

            return target_path

    @retry
    async def patch_json(self, path: str, data: dict) -> dict:
        """Make a JSON-encoded patch request.

        Returns the JSON response from the patch request as a dict.

        :param path: the API path to make the request against
        :param data: the data to send with the request
        :return: the response as a dictionary of decoded JSON
        """
        async with self.http.patch(
            f"{self.jobs_api_connection_string}{path}",
            json=data,
        ) as resp:
            await raise_exception_by_status_code(resp)
            return await decode_json_response(resp)

    @retry
    async def post_file(
        self,
        path: str,
        file_path: Path,
        file_format: VirtoolFileFormat,
        params: dict | None = None,
    ) -> None:
        if not params:
            params = {"name": file_path.name}

        if file_format is not None:
            params.update(format=file_format)

        async with self.http.post(
            f"{self.jobs_api_connection_string}{path}",
            data={"file": open(file_path, "rb")},
            params=params,
        ) as response:
            await raise_exception_by_status_code(response)

    @retry
    async def post_json(self, path: str, data: dict) -> dict:
        async with self.http.post(
            f"{self.jobs_api_connection_string}{path}",
            json=data,
        ) as resp:
            await raise_exception_by_status_code(resp)
            return await decode_json_response(resp)

    @retry
    async def put_file(
        self,
        path: str,
        file_path: Path,
        file_format: VirtoolFileFormat,
        params: dict | None = None,
    ) -> None:
        if not params:
            params = {"name": file_path.name}

        if file_format is not None:
            params.update(format=file_format)

        async with self.http.put(
            f"{self.jobs_api_connection_string}{path}",
            data={"file": open(file_path, "rb")},
            params=params,
        ) as response:
            await raise_exception_by_status_code(response)

    @retry
    async def put_json(self, path: str, data: dict) -> dict:
        async with self.http.put(
            f"{self.jobs_api_connection_string}{path}",
            json=data,
        ) as resp:
            await raise_exception_by_status_code(resp)
            return await decode_json_response(resp)

    @retry
    async def delete(self, path: str) -> dict | None:
        """Make a delete request against the provided API ``path``."""
        async with self.http.delete(f"{self.jobs_api_connection_string}{path}") as resp:
            await raise_exception_by_status_code(resp)

            try:
                return await decode_json_response(resp)
            except ValueError:
                return None


@asynccontextmanager
async def api_client(
    jobs_api_connection_string: str,
    job_id: str,
    key: str,
) -> AsyncIterator[WorkflowAPIClient]:
    """Create an authenticated :class:``APIClient`` to make API request."""
    async with ClientSession(
        auth=BasicAuth(login=f"job-{job_id}", password=key),
    ) as http:
        yield WorkflowAPIClient(http, jobs_api_connection_string)
