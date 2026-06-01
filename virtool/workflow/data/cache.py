from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any

from pyfixtures import fixture
from structlog import get_logger

from virtool.workflow.client import WorkflowAPIClient
from virtool.workflow.data.tar import (
    extract_tar_to_dir,
    get_tar_size,
    stream_path_as_tar,
)
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

    async def get(self, key: str, target: Path) -> CacheHit | CacheMiss:
        self._make_path()

        archive_path = self._get_archive_path(key)

        try:
            await self._api.get_cache(key, archive_path)
        except JobsAPINotFoundError:
            logger.info("cache miss", key=key)
            return CacheMiss(key)

        self._prepare_target(target)
        await extract_tar_to_dir(archive_path, target)

        logger.info("cache hit", key=key)
        return CacheHit(key, target)

    async def put(
        self,
        key: str,
        source: Path,
        params: dict[str, Any] | None = None,
    ) -> bool:
        self._make_path()

        size = await get_tar_size(source)
        created = await self._api.put_cache(
            key,
            stream_path_as_tar(source),
            size,
            params,
        )

        logger.info("cache put", key=key, created=created)
        return created

    def _get_archive_path(self, key: str) -> Path:
        return self._path / f"{sha256(key.encode()).hexdigest()}.tar"

    def _make_path(self) -> None:
        self._path.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _prepare_target(target: Path) -> None:
        if not target.exists():
            return

        if not target.is_dir():
            raise NotADirectoryError(target)

        if any(target.iterdir()):
            raise FileExistsError(target)


@fixture
async def cache(_api: WorkflowAPIClient, work_path: Path) -> WorkflowCache:
    return WorkflowCache(_api, work_path)
