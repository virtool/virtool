import asyncio
import gzip
from collections.abc import AsyncIterator

from aiohttp import ClientSession
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceNotFoundError
from virtool.hmm.db import (
    fetch_and_update_release,
    generate_annotations,
)
from virtool.hmm.models import HMM
from virtool.hmm.sql import HMM_STATUS_ID, SQLHMM, SQLHMMStatus
from virtool.hmm.utils import create_update_subdocument
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.tasks.progress import (
    AbstractProgressHandler,
    AccumulatingProgressHandlerWrapper,
)

HMM_PROFILES_KEY = "hmm/profiles.hmm"
"""The storage key for the HMM profiles file."""

HMM_ANNOTATIONS_KEY = "hmm/annotations.json.gz"
"""The storage key for the gzipped HMM annotations file."""


class HmmsData(DataLayerDomain):
    name = "hmms"

    def __init__(
        self,
        client: ClientSession,
        pg: AsyncEngine,
        storage: StorageBackend,
    ):
        self._client = client
        self._pg = pg
        self._storage = storage

    async def get(self, hmm_id: int) -> HMM:
        async with AsyncSession(self._pg) as session:
            hmm = (
                await session.execute(
                    select(SQLHMM).where(SQLHMM.id == hmm_id),
                )
            ).scalar_one_or_none()

        if hmm is None:
            raise ResourceNotFoundError()

        return HMM(
            id=hmm.id,
            cluster=hmm.cluster,
            count=hmm.count,
            length=hmm.length,
            mean_entropy=hmm.mean_entropy,
            total_entropy=hmm.total_entropy,
            names=hmm.names,
            families=hmm.families,
            genera=hmm.genera,
            entries=hmm.entries,
        )

    async def install(
        self,
        annotations: list[dict],
        release,
        user_id: int,
        progress_handler: AbstractProgressHandler,
        profile_data: AsyncIterator[bytes],
    ) -> None:
        tracker = AccumulatingProgressHandlerWrapper(progress_handler, len(annotations))

        try:
            release_id = int(release["id"])
        except TypeError:
            release_id = release["id"]

        installed = create_update_subdocument(release, True, user_id)

        wrote_profiles = False

        try:
            async with AsyncSession(self._pg) as session:
                for annotation in annotations:
                    session.add(
                        SQLHMM(
                            cluster=annotation["cluster"],
                            count=annotation["count"],
                            length=annotation["length"],
                            mean_entropy=annotation["mean_entropy"],
                            total_entropy=annotation["total_entropy"],
                            hidden=False,
                            names=annotation["names"],
                            families=annotation["families"],
                            genera=annotation["genera"],
                            entries=annotation["entries"],
                        ),
                    )

                    await tracker.add(1)

                # Set ``installed`` and flip the matching update's ``ready``
                # flag only when the singleton row exists and carries an update
                # for this release.
                status = (
                    await session.execute(
                        select(SQLHMMStatus).where(SQLHMMStatus.id == HMM_STATUS_ID),
                    )
                ).scalar_one_or_none()

                if status is not None and any(
                    update_.get("id") == release_id for update_ in status.updates
                ):
                    status.installed = installed
                    status.updates = [
                        {**update_, "ready": True}
                        if update_.get("id") == release_id
                        else update_
                        for update_ in status.updates
                    ]

                wrote_profiles = True
                await self._storage.write(HMM_PROFILES_KEY, profile_data)

                # The cached annotations blob describes the annotation rows this
                # install replaces. Drop it before the commit so it can never
                # outlive them; a rollback only costs a regeneration.
                await self._storage.delete(HMM_ANNOTATIONS_KEY)

                await session.commit()
        except Exception:
            # Clean up the profiles blob on any failure from the write attempt
            # onward, then re-raise. ``write`` is not atomic from the caller's
            # perspective: a failure can leave an incomplete multipart upload on
            # S3 or a partially written file on disk. A commit-time failure rolls
            # back the Postgres transaction but leaves a fully written blob
            # orphaned ahead of it. ``wrote_profiles`` gates the delete so a
            # failure before the write does not destroy a prior install's
            # profiles file. ``delete`` is idempotent.
            if wrote_profiles:
                await self._storage.delete(HMM_PROFILES_KEY)
            raise

    async def download_profiles(self) -> tuple[AsyncIterator[bytes], int]:
        try:
            size = await self._storage.size(HMM_PROFILES_KEY)
        except StorageKeyNotFoundError as err:
            raise ResourceNotFoundError("Profiles file could not be found") from err

        return self._storage.read(HMM_PROFILES_KEY), size

    async def download_annotations(self) -> tuple[AsyncIterator[bytes], int]:
        try:
            size = await self._storage.size(HMM_ANNOTATIONS_KEY)
        except StorageKeyNotFoundError:
            pass
        else:
            return self._storage.read(HMM_ANNOTATIONS_KEY), size

        annotations_bytes = await generate_annotations(self._pg)
        compressed = await asyncio.to_thread(
            gzip.compress,
            annotations_bytes,
            compresslevel=6,
        )

        async def _data():
            yield compressed

        await self._storage.write(HMM_ANNOTATIONS_KEY, _data())

        return self._storage.read(HMM_ANNOTATIONS_KEY), len(compressed)

    async def clean_status(self) -> None:
        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLHMMStatus)
                .where(SQLHMMStatus.id == HMM_STATUS_ID)
                .values(installed=None, task_id=None, updates=[]),
            )
            await session.commit()

    async def update_release(self) -> None:
        await fetch_and_update_release(
            self._client,
            self._pg,
        )
