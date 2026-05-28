import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from http import HTTPStatus
from pathlib import Path
from tempfile import TemporaryFile
from typing import Any, BinaryIO
from urllib.parse import quote

import aiofiles
from aiohttp import BasicAuth, ClientSession, ClientTimeout
from structlog import get_logger

from virtool.api.custom_json import dump_string
from virtool.workflow.api.utils import (
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

    @retry
    async def head_cache(self, key: str) -> bool:
        path = self._get_cache_path(key)

        async with self.http.get(f"{self.jobs_api_connection_string}{path}") as resp:
            if resp.status == HTTPStatus.OK:
                return True

            if resp.status == HTTPStatus.NOT_FOUND:
                return False

            await raise_exception_by_status_code(resp)

    @retry
    async def get_cache(self, key: str) -> bool:
        return await self.head_cache(key)

    @retry
    async def get_cache_blob(self, key: str, dest: Path) -> None:
        path = self._get_cache_path(key)

        async with self.http.get(f"{self.jobs_api_connection_string}{path}") as resp:
            if resp.status != HTTPStatus.OK:
                await raise_exception_by_status_code(resp)

            async with aiofiles.open(dest, "wb") as f:
                async for chunk in resp.content.iter_chunked(API_CHUNK_SIZE):
                    await f.write(chunk)

    @retry
    async def put_cache(
        self,
        key: str,
        params: dict[str, Any],
        fileobj: BinaryIO | AsyncIterator[bytes],
    ) -> bool:
        async with (
            _cache_blob_body(fileobj) as (body, size),
            self.http.put(
                f"{self.jobs_api_connection_string}{self._get_cache_path(key)}",
                data=body,
                headers={
                    "Content-Length": str(size),
                    "Content-Type": "application/octet-stream",
                },
                params={"params": dump_string(params)},
            ) as resp,
        ):
            await raise_exception_by_status_code(resp)
            return resp.status == HTTPStatus.CREATED

    @staticmethod
    def _get_cache_path(key: str) -> str:
        return f"/caches/{quote(key, safe='')}"


@asynccontextmanager
async def _cache_blob_body(fileobj: BinaryIO | AsyncIterator[bytes]):
    if hasattr(fileobj, "__aiter__"):
        with TemporaryFile("w+b") as temp_file:
            size = 0

            async for chunk in fileobj:
                await asyncio.to_thread(temp_file.write, chunk)
                size += len(chunk)

            temp_file.seek(0)
            yield temp_file, size

        return

    try:
        start = fileobj.tell()
        fileobj.seek(0, os.SEEK_END)
        end = fileobj.tell()
        fileobj.seek(start)
    except (AttributeError, OSError):
        with TemporaryFile("w+b") as temp_file:
            size = 0

            while chunk := await asyncio.to_thread(fileobj.read, API_CHUNK_SIZE):
                await asyncio.to_thread(temp_file.write, chunk)
                size += len(chunk)

            temp_file.seek(0)
            yield temp_file, size

        return

    yield fileobj, end - start


@asynccontextmanager
async def api_client(
    jobs_api_connection_string: str,
    job_id: int,
    key: str,
) -> AsyncIterator[WorkflowAPIClient]:
    """Create an authenticated :class:``APIClient`` to make API request."""
    timeout = ClientTimeout(total=600, sock_read=60, sock_connect=30)
    async with ClientSession(
        auth=BasicAuth(login=f"job-{job_id}", password=key),
        timeout=timeout,
    ) as http:
        yield WorkflowAPIClient(http, jobs_api_connection_string)
