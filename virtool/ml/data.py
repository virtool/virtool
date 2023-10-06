import asyncio
from logging import getLogger
from typing import List, Dict

import arrow
from sqlalchemy import select, desc, asc
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.orm import joinedload

from virtool.config import Config
from virtool.data.errors import ResourceNotFoundError
from virtool.data.file import FileDescriptor
from virtool.data.http import HTTPClient
from virtool.data.domain import DataLayerDomain
from virtool.ml.models import (
    MLModel,
    MLModelMinimal,
    MLModelRelease,
    MLModelListResult,
)
from virtool.ml.pg import SQLMLModel, SQLMLModelRelease
from virtool.ml.tasks import SyncMLModelsTask
from virtool.releases import (
    fetch_release_manifest_from_virtool,
    ReleaseType,
    ReleaseManifestItem,
)
from virtool.tasks.models import SQLTask
from virtool.utils import timestamp

logger = getLogger("ml")


class MLData(DataLayerDomain):
    """A data layer piece for interacting with machine learning models."""

    def __init__(
        self,
        config: Config,
        http: HTTPClient,
        pg: AsyncEngine,
    ):
        self._config = config
        self._http = http
        self._pg = pg

    async def list(self) -> MLModelListResult:
        """
        Get a list of minimal representations of all ML models and the last time
        it was synced with www.virtool.ca.

        :return: all ML models and the last time they were synced with www.virtool.ca.

        """
        async with AsyncSession(self._pg) as session:
            stmt = (
                select(SQLMLModel)
                .order_by(asc(SQLMLModel.name))
                .options(joinedload(SQLMLModel.releases))
            )

            result = await session.execute(stmt)

            items = [
                MLModelMinimal(
                    id=one.id,
                    created_at=one.created_at,
                    description=one.description,
                    latest_release=MLModelRelease(
                        id=one.releases[0].id,
                        created_at=one.releases[0].created_at,
                        download_url=one.releases[0].download_url,
                        github_url=one.releases[0].github_url,
                        name=one.releases[0].name,
                        published_at=one.releases[0].published_at,
                        ready=one.releases[0].ready,
                        size=one.releases[0].size,
                    )
                    if one.releases
                    else None,
                    name=one.name,
                    release_count=len(one.releases),
                )
                for one in result.scalars().unique()
            ]

            result = (
                (
                    await session.execute(
                        select(SQLTask)
                        .filter_by(type=SyncMLModelsTask.name)
                        .order_by(desc(SQLTask.created_at))
                    )
                )
                .scalars()
                .first()
            )

            # The last time the ML models were synced with be none if the task has never
            # been run.
            last_synced_at = result.created_at if result else None

            return MLModelListResult(items=items, last_synced_at=last_synced_at)

    async def get(self, model_id: int) -> MLModel:
        """
        Get the complete representation of an ML model.

        :param model_id: the ID of the ML model to get.
        :return: the complete representation of the ML model.

        """
        async with AsyncSession(self._pg) as session:
            stmt = (
                select(SQLMLModel)
                .options(joinedload(SQLMLModel.releases))
                .filter_by(id=model_id)
            )

            result = await session.execute(stmt)

            model = result.scalars().unique().one_or_none()

            if model is None:
                raise ValueError(f"ML model with ID {model_id} not found")

            releases = [
                MLModelRelease(
                    id=r.id,
                    created_at=r.created_at,
                    download_url=r.download_url,
                    github_url=r.github_url,
                    name=r.name,
                    published_at=r.published_at,
                    ready=r.ready,
                    size=r.size,
                )
                for r in model.releases
            ]
            return MLModel(
                id=model.id,
                created_at=model.created_at,
                description=model.description,
                latest_release=releases[0] if releases else None,
                name=model.name,
                release_count=len(model.releases),
                releases=releases,
            )

    async def download_release(self, release_id: int) -> FileDescriptor:
        """
        Download the latest release of an ML model.

        :param release_id: the ID of the release to download.
        :return: a file descriptor for the downloaded file.

        """
        async with AsyncSession(self._pg) as session:
            stmt = select(SQLMLModelRelease).filter_by(id=release_id)

            result = await session.execute(stmt)

            release = result.scalars().unique().one_or_none()

            if release is None:
                raise ResourceNotFoundError

            return FileDescriptor(
                self._config.data_path / "ml" / str(release_id) / "model.tar.gz",
                release.size,
            )

    async def load(self, releases: Dict[str, List[ReleaseManifestItem]]):
        """
        Load into the database.

        This method is intended to be called by the `sync` method or data faking
        functions.

        :param releases: the release manifest for ML models from www.virtool.ca.

        """
        ml_path = self._config.data_path / "ml"

        created_at = timestamp()

        for repo_name in releases:
            async with AsyncSession(self._pg) as session:
                ml_model = (
                    (
                        await session.execute(
                            select(SQLMLModel)
                            .filter_by(name=repo_name)
                            .options(joinedload(SQLMLModel.releases))
                        )
                    )
                    .scalars()
                    .unique()
                    .one_or_none()
                )

                if ml_model:
                    for r in releases[repo_name]:
                        cmd = (
                            insert(SQLMLModelRelease.__table__)
                            .on_conflict_do_nothing()
                            .values(
                                name=r.name,
                                created_at=created_at,
                                download_url=r.download_url,
                                github_url=r.html_url,
                                published_at=r.published_at,
                                ready=False,
                                model_id=ml_model.id,
                                size=r.size,
                            )
                        )

                        await session.execute(cmd)
                else:
                    ml_model = SQLMLModel(
                        created_at=created_at,
                        name=repo_name,
                        releases=[
                            SQLMLModelRelease(
                                name=r.name,
                                created_at=created_at,
                                download_url=r.download_url,
                                github_url=r.html_url,
                                published_at=r.published_at,
                                ready=False,
                                size=r.size,
                            )
                            for r in releases[repo_name]
                        ],
                    )

                    session.add(ml_model)

                await session.flush()

                for release in ml_model.releases:
                    release_path = ml_path / str(release.id)

                    await asyncio.to_thread(
                        release_path.mkdir,
                        parents=True,
                        exist_ok=True,
                    )

                    release_path /= "model.tar.gz"

                    if not await asyncio.to_thread(release_path.exists):
                        await self._http.download(release.download_url, release_path)

                await session.commit()

    async def sync(self):
        """
        Fetch the release manifests for ML models from www.virtool.ca and download any
        missing data.

        This method is intended to be called periodically by a scheduled task.
        """
        logger.info("Syncing ML models with www.virtool.ca")

        releases = await fetch_release_manifest_from_virtool(
            self._http._session, ReleaseType.ML
        )

        if releases:
            data = {}

            for name, model_releases in releases.items():
                data[name] = [
                    ReleaseManifestItem(
                        id=r["id"],
                        body=r["body"],
                        content_type=r["content_type"],
                        download_url=r["download_url"],
                        filename=r["filename"],
                        html_url=r["html_url"],
                        name=r["name"],
                        prerelease=r["prerelease"],
                        published_at=arrow.get(r["published_at"]).naive,
                        size=r["size"],
                    )
                    for r in model_releases
                ]

            return await self.load(data)

        logger.warning("Could not fetch ML model releases from www.virtool.ca")
