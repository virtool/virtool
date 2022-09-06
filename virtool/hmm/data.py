import asyncio
from pathlib import Path

from aiohttp import ClientSession
from multidict import MultiDictProxy
from virtool_core.models.hmm import (
    HMMSearchResult,
    HMM,
    HMMStatus,
    HMMInstalled,
)
from virtool_core.utils import rm, compress_file_with_gzip

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
from virtool.tasks.client import TasksClient
from virtool.users.db import AttachUserTransform
from virtool.utils import run_in_thread


class HmmData(DataLayerPiece):
    def __init__(
        self, client: ClientSession, config: Config, mongo, tasks: TasksClient
    ):
        self._client = client
        self._config = config
        self._mongo = mongo
        self._tasks = tasks

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

    async def purge(self):
        """
        Remove profiles.hmm and all HMM annotations unreferenced in analyses.

        """
        referenced_ids = await virtool.hmm.db.get_referenced_hmm_ids(
            self._mongo, self._config.data_path
        )

        async with self._mongo.create_session() as session:
            await self._mongo.hmm.delete_many(
                {"_id": {"$nin": referenced_ids}}, session=session
            )

            await self._mongo.hmm.update_many(
                {}, {"$set": {"hidden": True}}, session=session
            )

            await self._mongo.status.find_one_and_update(
                {"_id": "hmm"},
                {"$set": {"installed": None, "task": None, "updates": []}},
                session=session,
            )

        try:
            await run_in_thread(rm, self._config.data_path / "hmm" / "profiles.hmm")
        except FileNotFoundError:
            pass

        settings = await self.data.settings.get_all()

        await virtool.hmm.db.fetch_and_update_release(
            self._config, self._client, self._mongo, settings.hmm_slug
        )

    async def get_status(self):
        document = await self._mongo.status.find_one("hmm")

        document["updating"] = (
            len(document["updates"]) > 1 and document["updates"][-1]["ready"]
        )

        document["installed"] = await apply_transforms(
            document["installed"], [AttachUserTransform(self._mongo)]
        )

        return HMMStatus(**document)

    async def install_update(self, user_id: str) -> HMMInstalled:
        if await self._mongo.status.count_documents(
            {"_id": "hmm", "updates.ready": False}
        ):
            raise ResourceConflictError("Install already in progress")

        settings = await self.data.settings.get_all()

        await virtool.hmm.db.fetch_and_update_release(
            self._config,
            self._client,
            self._mongo,
            settings.hmm_slug,
        )

        release = await get_one_field(self._mongo.status, "release", "hmm")

        if release:
            raise ResourceError("Target release does not exist")

        task = await self._tasks.add(
            HMMInstallTask, context={"user_id": user_id, "release": release}
        )

        update = create_update_subdocument(release, False, user_id)

        await self._mongo.status.find_one_and_update(
            {"_id": "hmm"},
            {"$set": {"task": {"id": task["id"]}}, "$push": {"updates": update}},
        )

        return HMMInstalled(**update)

    async def get_profiles_path(self) -> Path:
        file_path = self._config.data_path / "hmm" / "profiles.hmm"

        if await run_in_thread(hmm_data_exists, file_path):
            return file_path

        raise ResourceNotFoundError("Profiles file could not be found")

    async def get_annotations_path(self) -> Path:
        path = self._config.data_path / "hmm" / "annotations.json.gz"

        if await run_in_thread(path.exists):
            return path

        json_path = await generate_annotations_json_file(
            self._config.data_path, self._mongo
        )

        await run_in_thread(compress_file_with_gzip, json_path, path)

        return path
