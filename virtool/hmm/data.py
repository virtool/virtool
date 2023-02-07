import asyncio
import shutil
from asyncio import to_thread
from functools import cached_property
from pathlib import Path
from typing import List, Dict

from aiohttp import ClientSession
from multidict import MultiDictProxy
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.hmm import (
    HMMSearchResult,
    HMM,
    HMMStatus,
    HMMInstalled,
)
from virtool_core.utils import compress_file_with_gzip

import virtool.hmm.db
from virtool.api.utils import compose_regex_query, paginate
from virtool.config.cls import Config
from virtool.data.errors import (
    ResourceNotFoundError,
    ResourceConflictError,
    ResourceError,
)
from virtool.data.piece import DataLayerPiece
from virtool.github import create_update_subdocument
from virtool.hmm.db import (
    PROJECTION,
    generate_annotations_json_file,
)
from virtool.hmm.tasks import HMMInstallTask
from virtool.hmm.utils import hmm_data_exists
from virtool.mongo.transforms import apply_transforms
from virtool.mongo.utils import get_one_field
from virtool.tasks.progress import (
    AbstractProgressHandler,
    AccumulatingProgressHandlerWrapper,
)
from virtool.tasks.transforms import AttachTaskTransform
from virtool.users.db import AttachUserTransform


class HmmData(DataLayerPiece):
    def __init__(self, client: ClientSession, config: Config, mongo, pg: AsyncEngine):
        self._client = client
        self._config = config
        self._mongo = mongo
        self._pg = pg

    @cached_property
    def profiles_path(self) -> Path:
        """The path to the HMM profiles file in the application data."""
        return self._config.data_path / "hmm" / "profiles.hmm"

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
                projection=PROJECTION,
                base_query={"hidden": False},
            ),
            self.get_status(),
        )

        return HMMSearchResult(**data, status=status)

    async def get(self, hmm_id: str) -> HMM:
        """
        Get an HMM resource.

        :param hmm_id: the id of the hmm to get
        :return: the hmm
        """
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
                installed, [AttachUserTransform(self._mongo)]
            )

        document = await apply_transforms(document, [AttachTaskTransform(self._pg)])

        return HMMStatus(**document)

    async def install_update(self, user_id: str) -> HMMInstalled:
        if await self._mongo.status.count_documents(
            {"_id": "hmm", "updates.ready": False}
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
            HMMInstallTask, context={"user_id": user_id, "release": release}
        )

        update = create_update_subdocument(release, False, user_id)

        await self._mongo.status.find_one_and_update(
            {"_id": "hmm"},
            {"$set": {"task": {"id": task.id}}, "$push": {"updates": update}},
        )

        installed = await apply_transforms(
            {**release, **update}, [AttachUserTransform(self._mongo)]
        )

        return HMMInstalled(**installed)

    async def install(
        self,
        annotations: List[Dict],
        release,
        user_id: str,
        progress_handler: AbstractProgressHandler,
        hmm_temp_profile_path,
    ):
        """
        Installs annotation and profiles given a list of annotation dictionaries and
        path to profile file.

        """
        tracker = AccumulatingProgressHandlerWrapper(progress_handler, len(annotations))

        try:
            release_id = int(release["id"])
        except TypeError:
            release_id = release["id"]

        async with self._mongo.create_session() as session:
            for annotation in annotations:
                await self._mongo.hmm.insert_one(
                    dict(annotation, hidden=False), session=session
                )
                await tracker.add(1)

            await self._mongo.status.update_one(
                {"_id": "hmm", "updates.id": release_id},
                {
                    "$set": {
                        "installed": create_update_subdocument(release, True, user_id),
                        "updates.$.ready": True,
                    }
                },
                session=session,
            )

            try:
                await to_thread(
                    shutil.move,
                    str(hmm_temp_profile_path),
                    str(self.profiles_path),
                )
            except Exception:
                await session.abort_transaction()
                raise

    async def get_profiles_path(self) -> Path:
        file_path = self._config.data_path / "hmm" / "profiles.hmm"

        if await to_thread(hmm_data_exists, file_path):
            return file_path

        raise ResourceNotFoundError("Profiles file could not be found")

    async def get_annotations_path(self) -> Path:
        path = self._config.data_path / "hmm" / "annotations.json.gz"

        if await to_thread(path.exists):
            return path

        json_path = await generate_annotations_json_file(
            self._config.data_path, self._mongo
        )

        await to_thread(compress_file_with_gzip, json_path, path)

        return path

    async def clean_status(self):
        """
        Reset the HMM status to its starting state.

        This is called in the event that an HMM data installation fails.
        """
        async with self._mongo.create_session() as session:
            await self._mongo.status.find_one_and_update(
                {"_id": "hmm"},
                {"$set": {"installed": None, "task": None, "updates": []}},
                session=session,
            )
