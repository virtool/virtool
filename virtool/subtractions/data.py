import asyncio
import shutil
from asyncio import CancelledError
from logging import getLogger
from typing import Optional

from aiohttp import MultipartReader
from multidict import MultiDictProxy
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.subtraction import (
    Subtraction,
    SubtractionSearchResult,
    SubtractionFile,
)
from virtool_core.utils import rm

import virtool.mongo.utils
import virtool.utils
from virtool.api.utils import compose_regex_query, paginate
from virtool.config import Config
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.file import FileDescriptor
from virtool.data.piece import DataLayerPiece
from virtool.jobs.utils import JobRights
from virtool.mongo.transforms import apply_transforms
from virtool.mongo.utils import get_one_field
from virtool.pg.utils import get_row_by_id
from virtool.subtractions.db import (
    attach_computed,
    PROJECTION,
    unlink_default_subtractions,
)
from virtool.subtractions.models import SubtractionFile as SQLSubtractionFile
from virtool.subtractions.oas import (
    CreateSubtractionRequest,
    UpdateSubtractionRequest,
    FinalizeSubtractionRequest,
)
from virtool.subtractions.utils import (
    join_subtraction_path,
    FILES,
    check_subtraction_file_type,
)
from virtool.uploads.models import Upload
from virtool.uploads.utils import naive_writer
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor, run_in_thread

logger = getLogger(__name__)


class SubtractionsData(DataLayerPiece):
    def __init__(self, base_url: str, config: Config, mongo, pg: AsyncEngine):
        self._base_url = base_url
        self._config = config
        self._mongo = mongo
        self._pg = pg

    async def find(self, find: str, short: bool, ready: bool, query: MultiDictProxy):
        db_query = {}

        if find:
            db_query = compose_regex_query(find, ["name", "nickname"])

        if ready:
            db_query["ready"] = True

        if short:
            return [
                base_processor(document)
                async for document in self._mongo.subtraction.find(
                    {**db_query, "deleted": False}, ["name", "ready"]
                ).sort("name")
            ]

        data = await paginate(
            self._mongo.subtraction,
            db_query,
            query,
            base_query={"deleted": False},
            sort="name",
            projection=PROJECTION,
        )

        documents, ready_count = await asyncio.gather(
            apply_transforms(
                data["documents"],
                [AttachUserTransform(self._mongo, ignore_errors=True)],
            ),
            self._mongo.subtraction.count_documents({"ready": True}),
        )

        return SubtractionSearchResult(
            **{**data, "documents": documents, "ready_count": ready_count}
        )

    async def create(
        self,
        data: CreateSubtractionRequest,
        user_id: str,
        subtraction_id: Optional[str] = None,
    ) -> Subtraction:
        """
        Create a new subtraction.

        :param data: a subtraction creation request
        :param user_id: the id of the creating user
        :param subtraction_id: the id of the subtraction
        :return: the subtraction

        """

        upload = await get_row_by_id(self._pg, Upload, data.upload_id)

        if upload is None:
            raise ResourceNotFoundError("Upload does not exist")

        await self._mongo.subtraction.insert_one(
            {
                "_id": subtraction_id
                or await virtool.mongo.utils.get_new_id(self._mongo.subtraction),
                "count": None,
                "created_at": virtool.utils.timestamp(),
                "deleted": False,
                "file": {
                    "id": upload.id,
                    "name": upload.name,
                },
                "gc": None,
                "name": data.name,
                "nickname": data.nickname,
                "ready": False,
                "upload": data.upload_id,
                "user": {"id": user_id},
            }
        )

        await self.data.jobs.create(
            "create_subtraction",
            {
                "subtraction_id": subtraction_id,
                "files": [{"id": upload.id, "name": upload.name}],
            },
            user_id,
            JobRights(),
        )

        return await self.get(subtraction_id)

    async def get(self, subtraction_id: str) -> Subtraction:
        document = await self._mongo.subtraction.find_one(subtraction_id)

        if document:
            document = await attach_computed(
                self._mongo,
                self._pg,
                self._base_url,
                document,
            )

            document = await apply_transforms(
                base_processor(document),
                [AttachUserTransform(self._mongo, ignore_errors=True)],
            )

            return Subtraction(**document)

        raise ResourceNotFoundError

    async def update(
        self, subtraction_id: str, data: UpdateSubtractionRequest
    ) -> Subtraction:
        data = data.dict(exclude_unset=True)

        update = {}

        if "name" in data:
            update["name"] = data["name"]

        if "nickname" in data:
            update["nickname"] = data["nickname"]

        document = await self._mongo.subtraction.find_one_and_update(
            {"_id": subtraction_id}, {"$set": update}
        )

        if document is None:
            raise ResourceNotFoundError

        return await self.get(subtraction_id)

    async def delete(self, subtraction_id: str):
        async with self._mongo.create_session() as session:
            update_result = await self._mongo.subtraction.update_one(
                {"_id": subtraction_id, "deleted": False},
                {"$set": {"deleted": True}},
                session=session,
            )

            if update_result.modified_count == 0:
                raise ResourceNotFoundError

            await asyncio.gather(
                unlink_default_subtractions(self._mongo, subtraction_id, session),
                run_in_thread(
                    shutil.rmtree,
                    join_subtraction_path(self._config, subtraction_id),
                    True,
                ),
            )

        return update_result.modified_count

    async def finalize(self, subtraction_id: str, data: FinalizeSubtractionRequest):
        """
        Finalize a subtraction.

        This sets values for the `results` and `gc` fields and switches the `ready`
        field to `true`.

        :param subtraction_id:
        :param data:
        :return:
        """
        ready = await get_one_field(self._mongo.subtraction, "ready", subtraction_id)

        if ready:
            raise ResourceConflictError("Subtraction has already been finalized")

        subtraction = await self._mongo.subtraction.update_one(
            {"_id": subtraction_id}, {"$set": {**data.dict(), "ready": True}}
        )

        if subtraction:
            return await self.get(subtraction_id)

        raise ResourceNotFoundError

    async def upload_file(
        self, subtraction_id: str, filename: str, reader: MultipartReader
    ) -> SubtractionFile:
        """
        Handle a subtraction file upload.

        Takes the ``subtraction_id`` for the subtraction the file should be associated
        with and a ``filename`` for the file. A ``ResourceConflictError`` is raised if a
        file with the same ``filename`` already exists.

        The upload is executed by passing in the ``MultipartReader`` from the upload
        request.

        :param subtraction_id: the id of the subtraction
        :param filename: the name of the file
        :param reader: the multipart reader containing the file content
        :return: the subtraction file resource model
        """
        document = await self._mongo.subtraction.find_one(subtraction_id)

        if document is None:
            raise ResourceNotFoundError

        if filename not in FILES:
            raise ResourceNotFoundError("Unsupported subtraction file name")

        file_type = check_subtraction_file_type(filename)

        path = self._config.data_path / "subtractions" / subtraction_id / filename

        try:
            async with AsyncSession(self._pg) as session:
                subtraction_file = SQLSubtractionFile(
                    name=filename, subtraction=subtraction_id, type=file_type
                )

                session.add(subtraction_file)

                try:
                    await session.flush()
                except IntegrityError:
                    raise ResourceConflictError("File name already exists")

                size = await naive_writer(reader, path)

                subtraction_file.size = size
                subtraction_file.uploaded_at = virtool.utils.timestamp()
                subtraction_file.ready = True

                session.add(subtraction_file)

                subtraction_file_dict = subtraction_file.to_dict()

                await session.commit()
        except CancelledError:
            await run_in_thread(
                rm,
                self._config.data_path / "subtractions" / subtraction_id / filename,
            )

        return SubtractionFile(
            **subtraction_file_dict,
            download_url=f"{self._base_url}/subtractions/{subtraction_id}/files/{filename}",
        )

    async def get_file(self, subtraction_id: str, filename: str):
        document = await self._mongo.subtraction.find_one(subtraction_id)

        if document is None or filename not in FILES:
            raise ResourceNotFoundError

        async with AsyncSession(self._pg) as session:
            result = (
                await session.execute(
                    select(SQLSubtractionFile).filter_by(
                        subtraction=subtraction_id, name=filename
                    )
                )
            ).scalar()

        if not result:
            raise ResourceNotFoundError

        file = result.to_dict()

        path = join_subtraction_path(self._config, subtraction_id) / filename

        if not await run_in_thread(path.is_file):
            logger.warning("")
            raise ResourceNotFoundError

        return FileDescriptor(path=path, size=file["size"])
