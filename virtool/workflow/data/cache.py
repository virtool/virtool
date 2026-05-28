from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any

from pyfixtures import fixture
from structlog import get_logger

from virtool.workflow.client import WorkflowAPIClient
from virtool.workflow.data.tar import get_tar_size, stream_dir_as_tar
from virtool.workflow.errors import JobsAPINotFoundError

logger = get_logger("api")


@dataclass
class CacheHit:
    key: str
    path: Path


@dataclass
class CacheMiss:
    key: str


class WorkflowCache:
    def __init__(self, api: WorkflowAPIClient, work_path: Path):
        self._api = api
        self._path = work_path / "caches"

    async def get(self, key: str) -> CacheHit | CacheMiss:
        self._make_path()

        path = self._get_path(key)

        try:
            await self._api.get_cache(key, path)
        except JobsAPINotFoundError:
            logger.info("cache miss", key=key)
            return CacheMiss(key)

        logger.info("cache hit", key=key)
        return CacheHit(key, path)

    async def put(
        self,
        key: str,
        source: Path,
        params: dict[str, Any] | None = None,
    ) -> bool:
        self._make_path()

        if source.is_dir():
            created = await self._put_directory(key, source, params)
        elif source.is_file():
            created = await self._put_file(key, source, params)
        else:
            raise FileNotFoundError(source)

        logger.info("cache put", key=key, created=created)
        return created

    def _get_path(self, key: str) -> Path:
        return self._path / sha256(key.encode()).hexdigest()

    def _make_path(self) -> None:
        self._path.mkdir(parents=True, exist_ok=True)

    async def _put_directory(
        self,
        key: str,
        source: Path,
        params: dict[str, Any] | None,
    ) -> bool:
        size = await get_tar_size(source)
        return await self._api.put_cache(key, stream_dir_as_tar(source), size, params)

    async def _put_file(
        self,
        key: str,
        source: Path,
        params: dict[str, Any] | None,
    ) -> bool:
        with source.open("rb") as file:
            return await self._api.put_cache(
                key,
                file,
                source.stat().st_size,
                params,
            )


@fixture
async def cache(_api: WorkflowAPIClient, work_path: Path) -> WorkflowCache:
    return WorkflowCache(_api, work_path)
