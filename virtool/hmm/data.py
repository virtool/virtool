import asyncio
import gzip
from collections.abc import AsyncIterator

from aiohttp import ClientSession
from multidict import MultiDictProxy
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.api.utils import compose_regex_query, paginate
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.topg import both_transactions
from virtool.data.transforms import apply_transforms
from virtool.github import create_update_subdocument
from virtool.hmm.db import (
    HMM_REPO_SLUG,
    HMMS_PROJECTION,
    fetch_and_update_release,
    generate_annotations,
)
from virtool.hmm.models import HMM, HMMInstalled, HMMSearchResult, HMMStatus
from virtool.hmm.sql import HMM_STATUS_ID, SQLHMM, SQLHMMStatus
from virtool.hmm.tasks import HMMInstallTask
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
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


class HmmsData(DataLayerDomain):
    name = "hmms"

    def __init__(
        self,
        client: ClientSession,
        mongo: Mongo,
        pg: AsyncEngine,
        storage: StorageBackend,
    ):
        self._client = client
        self._mongo = mongo
        self._pg = pg
        self._storage = storage

    async def find(self, query: MultiDictProxy):
        db_query = {}

        if term := query.get("find"):
            db_query.update(compose_regex_query(term, ["names"]))

        data, status = await asyncio.gather(
            paginate(
                self._mongo.hmm,
                db_query,
                query,
                sort="cluster",
                projection=HMMS_PROJECTION,
                base_query={"hidden": False},
            ),
            self.get_status(),
        )

        return HMMSearchResult(**data, status=status)

    async def get(self, hmm_id: str) -> HMM:
        document = await self._mongo.hmm.find_one({"_id": hmm_id})

        if document:
            return HMM(**document)

        raise ResourceNotFoundError()

    async def get_status(self):
        document = await self._mongo.status.find_one("hmm")

        document["updating"] = (
            bool(document["updates"]) and not document["updates"][-1]["ready"]
        )

        if installed := document.get("installed"):
            document["installed"] = await apply_transforms(
                installed,
                [AttachUserTransform(self._pg)],
                self._pg,
            )

        document = await apply_transforms(
            document, [AttachTaskTransform(self._pg)], self._pg
        )

        return HMMStatus(**document)

    async def install_update(self, user_id: int) -> HMMInstalled:
        if await self._mongo.status.count_documents(
            {"_id": "hmm", "updates.ready": False},
        ):
            raise ResourceConflictError("Install already in progress")

        await fetch_and_update_release(
            self._client,
            self._mongo,
            self._pg,
            HMM_REPO_SLUG,
        )

        release = await get_one_field(self._mongo.status, "release", "hmm")

        if not release:
            raise ResourceError("Target release does not exist")

        task = await self.data.tasks.create(
            HMMInstallTask,
            context={"user_id": user_id, "release": release},
        )

        update_subdocument = create_update_subdocument(release, False, user_id)

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.status.find_one_and_update(
                {"_id": "hmm"},
                {
                    "$set": {"task": {"id": task.id}},
                    "$push": {"updates": update_subdocument},
                },
                session=mongo_session,
            )

            status = (
                await pg_session.execute(
                    select(SQLHMMStatus).where(SQLHMMStatus.id == HMM_STATUS_ID),
                )
            ).scalar_one_or_none()

            if status is not None:
                status.task_id = task.id
                status.updates = [*status.updates, update_subdocument]

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
            async with both_transactions(self._mongo, self._pg) as (
                mongo_session,
                pg_session,
            ):
                for annotation in annotations:
                    inserted = await self._mongo.hmm.insert_one(
                        dict(annotation, hidden=False),
                        session=mongo_session,
                    )

                    pg_session.add(
                        SQLHMM(
                            legacy_id=inserted["_id"],
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

                await self._mongo.status.update_one(
                    {"_id": "hmm", "updates.id": release_id},
                    {"$set": {"installed": installed, "updates.$.ready": True}},
                    session=mongo_session,
                )

                # Mirror the conditional Mongo status update: set ``installed``
                # and flip the matching update's ``ready`` flag only when the
                # singleton row exists and carries an update for this release.
                status = (
                    await pg_session.execute(
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
        except Exception:
            # Clean up the profiles blob on any failure from the write attempt
            # onward, then re-raise. ``write`` is not atomic from the caller's
            # perspective: a failure can leave an incomplete multipart upload on
            # S3 or a partially written file on disk. A commit-time failure when
            # ``both_transactions`` exits rolls back both databases but leaves a
            # fully written blob orphaned ahead of them. ``wrote_profiles`` gates
            # the delete so a failure before the write does not destroy a prior
            # install's profiles file. ``delete`` is idempotent.
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

        annotations_bytes = await generate_annotations(self._mongo)
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
        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.status.find_one_and_update(
                {"_id": "hmm"},
                {"$set": {"installed": None, "task": None, "updates": []}},
                session=mongo_session,
            )

            await pg_session.execute(
                update(SQLHMMStatus)
                .where(SQLHMMStatus.id == HMM_STATUS_ID)
                .values(installed=None, task_id=None, updates=[]),
            )

    async def update_release(self) -> None:
        await fetch_and_update_release(
            self._client,
            self._mongo,
            self._pg,
            HMM_REPO_SLUG,
        )
