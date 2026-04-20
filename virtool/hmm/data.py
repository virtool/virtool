import asyncio
import gzip
from collections.abc import AsyncIterator
from pathlib import Path

from aiohttp import ClientSession
from multidict import MultiDictProxy
from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.hmm.db
from virtool.api.utils import compose_regex_query, paginate
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.transforms import apply_transforms
from virtool.github import create_update_subdocument
from virtool.hmm.db import (
    HMMS_PROJECTION,
    fetch_and_update_release,
    generate_annotations,
)
from virtool.hmm.models import HMM, HMMInstalled, HMMSearchResult, HMMStatus
from virtool.hmm.tasks import HMMInstallTask
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.storage.protocol import StorageBackend
from virtool.tasks.progress import (
    AbstractProgressHandler,
    AccumulatingProgressHandlerWrapper,
)
from virtool.tasks.transforms import AttachTaskTransform
from virtool.users.transforms import AttachUserTransform


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
            len(document["updates"]) > 1 and document["updates"][-1]["ready"]
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

    async def install_update(self, user_id: str) -> HMMInstalled:
        if await self._mongo.status.count_documents(
            {"_id": "hmm", "updates.ready": False},
        ):
            raise ResourceConflictError("Install already in progress")

        settings = await self.data.settings.get_all()

        await virtool.hmm.db.fetch_and_update_release(
            self._client,
            self._mongo,
            settings.hmm_slug,
        )

        release = await get_one_field(self._mongo.status, "release", "hmm")

        if not release:
            raise ResourceError("Target release does not exist")

        task = await self.data.tasks.create(
            HMMInstallTask,
            context={"user_id": user_id, "release": release},
        )

        update = create_update_subdocument(release, False, user_id)

        await self._mongo.status.find_one_and_update(
            {"_id": "hmm"},
            {"$set": {"task": {"id": task.id}}, "$push": {"updates": update}},
        )

        installed = await apply_transforms(
            {**release, **update},
            [AttachUserTransform(self._pg)],
            self._pg,
        )

        return HMMInstalled(**installed)

    async def install(
        self,
        annotations: list[dict],
        release,
        user_id: str,
        progress_handler: AbstractProgressHandler,
        profile_data: AsyncIterator[bytes],
    ) -> None:
        tracker = AccumulatingProgressHandlerWrapper(progress_handler, len(annotations))

        try:
            release_id = int(release["id"])
        except TypeError:
            release_id = release["id"]

        async with self._mongo.create_session() as session:
            for annotation in annotations:
                await self._mongo.hmm.insert_one(
                    dict(annotation, hidden=False),
                    session=session,
                )
                await tracker.add(1)

            await self._mongo.status.update_one(
                {"_id": "hmm", "updates.id": release_id},
                {
                    "$set": {
                        "installed": create_update_subdocument(release, True, user_id),
                        "updates.$.ready": True,
                    },
                },
                session=session,
            )

            try:
                await self._storage.write("hmm/profiles.hmm", profile_data)
            except Exception:
                await session.abort_transaction()
                raise

    async def download_profiles(self) -> tuple[AsyncIterator[bytes], int]:
        size = 0
        async for info in self._storage.list("hmm/profiles.hmm"):
            size = info.size
            break

        if not size:
            raise ResourceNotFoundError("Profiles file could not be found")

        return self._storage.read("hmm/profiles.hmm"), size

    async def download_annotations(self) -> tuple[AsyncIterator[bytes], int]:
        async for info in self._storage.list("hmm/annotations.json.gz"):
            return self._storage.read("hmm/annotations.json.gz"), info.size

        annotations_bytes = await generate_annotations(self._mongo)
        compressed = gzip.compress(annotations_bytes, compresslevel=6)

        async def _data():
            yield compressed

        await self._storage.write("hmm/annotations.json.gz", _data())

        return self._storage.read("hmm/annotations.json.gz"), len(compressed)

    async def clean_status(self) -> None:
        async with self._mongo.create_session() as session:
            await self._mongo.status.find_one_and_update(
                {"_id": "hmm"},
                {"$set": {"installed": None, "task": None, "updates": []}},
                session=session,
            )

    async def update_release(self) -> None:
        settings = await self.data.settings.get_all()

        await fetch_and_update_release(self._client, self._mongo, settings.hmm_slug)
