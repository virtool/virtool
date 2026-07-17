import asyncio
import gzip
import math
from collections.abc import AsyncIterator

from aiohttp import ClientSession
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.transforms import apply_transforms
from virtool.hmm.db import (
    fetch_and_update_release,
    generate_annotations,
)
from virtool.hmm.models import HMM, HMMInstalled, HMMSearchResult, HMMStatus
from virtool.hmm.sql import HMM_STATUS_ID, SQLHMM, SQLHMMStatus
from virtool.hmm.tasks import HMMInstallTask
from virtool.hmm.utils import create_update_subdocument
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.tasks.progress import (
    AbstractProgressHandler,
    AccumulatingProgressHandlerWrapper,
)
from virtool.tasks.transforms import AttachTaskTransform
from virtool.users.transforms import AttachUserTransform

HMM_PROFILES_KEY = "hmm/profiles.hmm"
"""The storage key for the HMM profiles file."""

HMM_ANNOTATIONS_KEY = "hmm/annotations.json.gz"
"""The storage key for the gzipped HMM annotations file."""


def _compose_hmm_search_filter(term: str):
    """Compose a case-insensitive substring match against any of an HMM's names.

    Mirrors the Mongo ``compose_regex_query(term, ["names"])`` behaviour the find
    endpoint used before reading from Postgres: ``names`` is an array, so the
    match succeeds when any element contains the term. The term is matched
    literally, so SQL ``LIKE`` wildcards in it are escaped rather than
    interpreted.
    """
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"

    elements = func.jsonb_array_elements_text(SQLHMM.names).table_valued("value")

    return (
        select(1)
        .select_from(elements)
        .where(elements.c.value.ilike(pattern, escape="\\"))
        .exists()
    )


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

    async def find(self, page: int, per_page: int, term: str | None = None):
        not_hidden = SQLHMM.hidden.is_(False)

        filters = [not_hidden]

        if term:
            filters.append(_compose_hmm_search_filter(term))

        data, status = await asyncio.gather(
            self._find(page, per_page, filters, not_hidden),
            self.get_status(),
        )

        return HMMSearchResult(**data, status=status)

    async def _find(self, page: int, per_page: int, filters: list, not_hidden) -> dict:
        async with AsyncSession(self._pg) as session:
            total_count = await session.scalar(
                select(func.count()).select_from(SQLHMM).where(not_hidden),
            )
            found_count = await session.scalar(
                select(func.count()).select_from(SQLHMM).where(*filters),
            )

            rows = (
                await session.execute(
                    select(SQLHMM)
                    .where(*filters)
                    .order_by(SQLHMM.cluster, SQLHMM.id)
                    .offset(per_page * (page - 1))
                    .limit(per_page),
                )
            ).scalars()

        return {
            "documents": [
                {
                    "id": row.id,
                    "cluster": row.cluster,
                    "count": row.count,
                    "families": row.families,
                    "names": row.names,
                }
                for row in rows
            ],
            "total_count": total_count,
            "found_count": found_count,
            "page_count": math.ceil(found_count / per_page),
            "per_page": per_page,
            "page": page,
        }

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

    async def get_status(self):
        async with AsyncSession(self._pg) as session:
            status = (
                await session.execute(
                    select(SQLHMMStatus).where(SQLHMMStatus.id == HMM_STATUS_ID),
                )
            ).scalar_one_or_none()

        if status is None:
            raise ResourceNotFoundError

        document = {
            "errors": status.errors,
            "release": status.release,
            "installed": status.installed,
            "task": {"id": status.task_id} if status.task_id else None,
            "updates": status.updates,
            "updating": bool(status.updates) and not status.updates[-1]["ready"],
        }

        if installed := document["installed"]:
            document["installed"] = await apply_transforms(
                installed,
                [AttachUserTransform(self._pg)],
                self._pg,
            )

        document = await apply_transforms(
            document, [AttachTaskTransform(self._pg)], self._pg
        )

        return HMMStatus(**document)

    async def get_updates(self) -> list[dict]:
        """List the HMM status updates, newest first."""
        async with AsyncSession(self._pg) as session:
            updates = (
                await session.execute(
                    select(SQLHMMStatus.updates).where(
                        SQLHMMStatus.id == HMM_STATUS_ID,
                    ),
                )
            ).scalar_one_or_none()

        if not updates:
            return []

        return list(reversed(updates))

    async def install_update(self, user_id: int) -> HMMInstalled:
        async with AsyncSession(self._pg) as session:
            updates = (
                await session.execute(
                    select(SQLHMMStatus.updates).where(
                        SQLHMMStatus.id == HMM_STATUS_ID,
                    ),
                )
            ).scalar_one_or_none()

        if updates and any(not update_["ready"] for update_ in updates):
            raise ResourceConflictError("Install already in progress")

        await fetch_and_update_release(
            self._client,
            self._pg,
        )

        async with AsyncSession(self._pg) as session:
            release = (
                await session.execute(
                    select(SQLHMMStatus.release).where(
                        SQLHMMStatus.id == HMM_STATUS_ID,
                    ),
                )
            ).scalar_one_or_none()

        if not release:
            raise ResourceError("Target release does not exist")

        task = await self.data.tasks.create(
            HMMInstallTask,
            context={"user_id": user_id, "release": release},
        )

        update_subdocument = create_update_subdocument(release, False, user_id)

        async with AsyncSession(self._pg) as session:
            status = (
                await session.execute(
                    select(SQLHMMStatus).where(SQLHMMStatus.id == HMM_STATUS_ID),
                )
            ).scalar_one_or_none()

            if status is not None:
                status.task_id = task.id
                status.updates = [*status.updates, update_subdocument]

            await session.commit()

        installed = await apply_transforms(
            {**release, **update_subdocument},
            [AttachUserTransform(self._pg)],
            self._pg,
        )

        return HMMInstalled(**installed)

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
