import math
from asyncio import CancelledError
from collections.abc import AsyncGenerator
from typing import TYPE_CHECKING

from multidict import MultiDictProxy
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.mongo.utils
import virtool.utils
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emits
from virtool.data.topg import both_transactions, compose_legacy_id_single_expression
from virtool.data.transforms import apply_transforms
from virtool.jobs.transforms import AttachJobTransform
from virtool.mongo.utils import get_one_field
from virtool.pg.utils import get_row_by_id
from virtool.storage.cleanup import delete_prefix
from virtool.storage.protocol import StorageBackend
from virtool.subtractions.db import (
    attach_computed,
    map_subtraction_row,
    unlink_default_subtractions,
)
from virtool.subtractions.models import (
    Subtraction,
    SubtractionFile,
    SubtractionSearchResult,
)
from virtool.subtractions.oas import (
    CreateSubtractionRequest,
    FinalizeSubtractionRequest,
    UpdateSubtractionRequest,
)
from virtool.subtractions.pg import SQLSubtraction, SQLSubtractionFile
from virtool.subtractions.utils import (
    FILES,
    check_subtraction_file_type,
    subtraction_file_key,
    subtraction_prefix,
)
from virtool.uploads.db import AttachUploadTransform
from virtool.uploads.sql import SQLUpload
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

logger = get_logger("subtractions")


def _compose_subtraction_search_filter(term: str):
    """Compose a case-insensitive substring match on ``name`` and ``nickname``.

    Mirrors the Mongo ``compose_regex_query`` behaviour the find endpoint used
    before reading from Postgres: the term is matched literally, so SQL ``LIKE``
    wildcards in the term are escaped rather than interpreted.
    """
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"

    return or_(
        SQLSubtraction.name.ilike(pattern, escape="\\"),
        SQLSubtraction.nickname.ilike(pattern, escape="\\"),
    )


class SubtractionsData(DataLayerDomain):
    name = "subtractions"

    def __init__(
        self,
        base_url: str,
        mongo: "Mongo",
        pg: AsyncEngine,
        storage: StorageBackend,
    ):
        self._base_url = base_url
        self._mongo = mongo
        self._pg = pg
        self._storage = storage

    async def find(self, find: str, short: bool, ready: bool, query: MultiDictProxy):
        not_deleted = SQLSubtraction.deleted.is_(False)

        filters = [not_deleted]

        if find:
            filters.append(_compose_subtraction_search_filter(find))

        if ready:
            filters.append(SQLSubtraction.ready.is_(True))

        if short:
            async with AsyncSession(self._pg) as session:
                rows = (
                    await session.execute(
                        select(
                            SQLSubtraction.legacy_id,
                            SQLSubtraction.name,
                            SQLSubtraction.ready,
                        )
                        .where(*filters)
                        .order_by(SQLSubtraction.name, SQLSubtraction.id),
                    )
                ).all()

            return [
                {"id": legacy_id, "name": name, "ready": is_ready}
                for legacy_id, name, is_ready in rows
            ]

        page = int(query.get("page", 1))
        per_page = int(query.get("per_page", 25))

        async with AsyncSession(self._pg) as session:
            total_count = await session.scalar(
                select(func.count()).select_from(SQLSubtraction).where(not_deleted),
            )
            ready_count = await session.scalar(
                select(func.count())
                .select_from(SQLSubtraction)
                .where(not_deleted, SQLSubtraction.ready.is_(True)),
            )
            found_count = await session.scalar(
                select(func.count()).select_from(SQLSubtraction).where(*filters),
            )

            rows = (
                await session.execute(
                    select(SQLSubtraction, SQLUpload)
                    .outerjoin(SQLUpload, SQLSubtraction.upload_id == SQLUpload.id)
                    .where(*filters)
                    .order_by(SQLSubtraction.name, SQLSubtraction.id)
                    .offset(per_page * (page - 1))
                    .limit(per_page),
                )
            ).all()

        documents = await apply_transforms(
            [
                base_processor(map_subtraction_row(subtraction, upload))
                for subtraction, upload in rows
            ],
            [AttachJobTransform(self._pg), AttachUserTransform(self._pg)],
            self._pg,
        )

        return SubtractionSearchResult(
            documents=documents,
            found_count=found_count,
            total_count=total_count,
            ready_count=ready_count,
            page=page,
            per_page=per_page,
            page_count=math.ceil(found_count / per_page),
        )

    @emits(Operation.CREATE)
    async def create(
        self,
        data: CreateSubtractionRequest,
        user_id: int,
        space_id: int,
        subtraction_id: str | None = None,
    ) -> Subtraction:
        """Create a new subtraction.
        :param data: a subtraction creation request
        :param user_id: the id of the creating user
        :param space_id: the id of the subtraction's parent space
        :param subtraction_id: the id of the subtraction
        :return: the subtraction
        """
        upload = await get_row_by_id(self._pg, SQLUpload, data.upload_id)

        if upload is None:
            raise ResourceNotFoundError("Upload does not exist")

        new_subtraction_id = subtraction_id or await virtool.mongo.utils.get_new_id(
            self._mongo.subtraction
        )

        job = await self.data.jobs.create(
            "create_subtraction",
            {"subtraction_id": new_subtraction_id},
            user_id,
            0,
        )

        created_at = virtool.utils.timestamp()

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.subtraction.insert_one(
                {
                    "_id": new_subtraction_id,
                    "count": None,
                    "created_at": created_at,
                    "deleted": False,
                    "file": {"id": upload.id, "name": upload.name},
                    "gc": None,
                    "job": {"id": job.id},
                    "name": data.name,
                    "nickname": data.nickname,
                    "ready": False,
                    "space": {"id": space_id},
                    "upload": data.upload_id,
                    "user": {"id": user_id},
                },
                session=mongo_session,
            )

            pg_session.add(
                SQLSubtraction(
                    legacy_id=new_subtraction_id,
                    name=data.name,
                    nickname=data.nickname,
                    count=None,
                    gc=None,
                    created_at=created_at,
                    deleted=False,
                    ready=False,
                    user_id=user_id,
                    job_id=job.id,
                    upload_id=data.upload_id,
                ),
            )

        return await self.get(new_subtraction_id)

    async def _resolve_ids(self, subtraction_id: int | str) -> tuple[int, str]:
        """Resolve either id form to the subtraction's ``(id, legacy_id)``.

        Accepts the modern integer id (or its stringified form) or the legacy Mongo
        slug and returns both identifiers. The integer ``id`` keys the
        ``SQLSubtraction`` mutations; the legacy slug is still needed for the Mongo
        dual-write, the string-keyed ``SQLSubtractionFile`` rows, and the storage
        keys. Mirrors :meth:`virtool.analyses.data.AnalysisData._resolve_ids`.

        :param subtraction_id: a modern integer id or legacy string id
        :return: the integer id and legacy string id
        :raises ResourceNotFoundError: if no subtraction matches
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLSubtraction.id, SQLSubtraction.legacy_id).where(
                        compose_legacy_id_single_expression(
                            SQLSubtraction,
                            subtraction_id,
                        ),
                    ),
                )
            ).one_or_none()

        if row is None:
            raise ResourceNotFoundError

        return row.id, row.legacy_id

    async def get(self, subtraction_id: int | str) -> Subtraction:
        """Get a subtraction by its id."""
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLSubtraction, SQLUpload)
                    .outerjoin(SQLUpload, SQLSubtraction.upload_id == SQLUpload.id)
                    .where(
                        compose_legacy_id_single_expression(
                            SQLSubtraction,
                            subtraction_id,
                        ),
                    ),
                )
            ).first()

        if row is None:
            raise ResourceNotFoundError

        subtraction, upload = row

        document = await attach_computed(
            self._mongo,
            self._pg,
            self._base_url,
            subtraction.id,
            map_subtraction_row(subtraction, upload),
        )

        document = await apply_transforms(
            base_processor(document),
            [
                AttachJobTransform(self._pg),
                AttachUploadTransform(self._pg),
                AttachUserTransform(self._pg, ignore_errors=True),
            ],
            self._pg,
        )

        return Subtraction(**document)

    @emits(Operation.UPDATE)
    async def update(
        self,
        subtraction_id: int | str,
        data: UpdateSubtractionRequest,
    ) -> Subtraction:
        modern_id, legacy_id = await self._resolve_ids(subtraction_id)

        data = data.dict(exclude_unset=True)

        values = {}

        if "name" in data:
            values["name"] = data["name"]

        if "nickname" in data:
            values["nickname"] = data["nickname"]

        if not values:
            return await self.get(modern_id)

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.subtraction.update_one(
                {"_id": legacy_id},
                {"$set": values},
                session=mongo_session,
            )

            await pg_session.execute(
                update(SQLSubtraction)
                .where(SQLSubtraction.id == modern_id)
                .values(**values),
            )

        return await self.get(modern_id)

    async def delete(self, subtraction_id: int | str):
        modern_id, legacy_id = await self._resolve_ids(subtraction_id)

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            update_result = await self._mongo.subtraction.update_one(
                {"_id": legacy_id, "deleted": False},
                {"$set": {"deleted": True}},
                session=mongo_session,
            )

            if update_result.modified_count == 0:
                raise ResourceNotFoundError

            await pg_session.execute(
                update(SQLSubtraction)
                .where(SQLSubtraction.id == modern_id)
                .values(deleted=True),
            )

            await unlink_default_subtractions(self._mongo, legacy_id, mongo_session)

        failures = await delete_prefix(self._storage, subtraction_prefix(legacy_id))

        for key, exc in failures:
            logger.error(
                "storage cleanup failed; file orphaned",
                subtraction_id=legacy_id,
                key=key,
                error=repr(exc),
            )

        return update_result.modified_count

    @emits(Operation.UPDATE)
    async def finalize(
        self,
        subtraction_id: int | str,
        data: FinalizeSubtractionRequest,
    ) -> Subtraction:
        """Finalize a subtraction.

        This sets values for the `results` and `gc` fields and switches the `ready`
        field to `true`.

        :param subtraction_id:
        :param data:
        :return: finalized subtraction
        """
        modern_id, legacy_id = await self._resolve_ids(subtraction_id)

        ready = await get_one_field(self._mongo.subtraction, "ready", legacy_id)

        if ready:
            raise ResourceConflictError("Subtraction has already been finalized")

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await self._mongo.subtraction.update_one(
                {"_id": legacy_id},
                {"$set": {**data.dict(), "ready": True}},
                session=mongo_session,
            )

            await pg_session.execute(
                update(SQLSubtraction)
                .where(SQLSubtraction.id == modern_id)
                .values(**data.dict(), ready=True),
            )

        return await self.get(modern_id)

    async def upload_file(
        self,
        subtraction_id: int | str,
        filename: str,
        chunker: AsyncGenerator[bytearray],
    ) -> SubtractionFile:
        """Handle a subtraction file upload.

        Takes the ``subtraction_id`` for the subtraction the file should be associated
        with and a ``filename`` for the file. A ``ResourceConflictError`` is raised if a
        file with the same ``filename`` already exists.

        The upload is executed by passing in the ``MultipartReader`` from the upload
        request.

        :param subtraction_id: the id of the subtraction
        :param filename: the name of the file
        :param chunker: the multipart reader containing the file content
        :return: the subtraction file resource model
        """
        modern_id, legacy_id = await self._resolve_ids(subtraction_id)

        if filename not in FILES:
            raise ResourceNotFoundError("Unsupported subtraction file name")

        file_type = check_subtraction_file_type(filename)

        key = subtraction_file_key(legacy_id, filename)

        try:
            async with AsyncSession(self._pg) as session:
                subtraction_file = SQLSubtractionFile(
                    name=filename,
                    subtraction_id=modern_id,
                    type=file_type,
                )

                session.add(subtraction_file)

                try:
                    await session.flush()
                except IntegrityError:
                    raise ResourceConflictError("File name already exists")

                size = await self._storage.write(key, chunker)

                subtraction_file.size = size
                subtraction_file.uploaded_at = virtool.utils.timestamp()
                subtraction_file.ready = True

                session.add(subtraction_file)

                subtraction_file_dict = subtraction_file.to_dict()

                await session.commit()
        except (CancelledError, Exception):
            await self._storage.delete(key)
            raise

        return SubtractionFile(
            **{**subtraction_file_dict, "subtraction": legacy_id},
            download_url=f"{self._base_url}/subtractions/{legacy_id}/files/{filename}",
        )

    async def get_file(self, subtraction_id: int | str, filename: str):
        modern_id, legacy_id = await self._resolve_ids(subtraction_id)

        if filename not in FILES:
            raise ResourceNotFoundError

        async with AsyncSession(self._pg) as session:
            result = (
                await session.execute(
                    select(SQLSubtractionFile).filter_by(
                        subtraction_id=modern_id,
                        name=filename,
                    ),
                )
            ).scalar()

        if not result:
            raise ResourceNotFoundError

        file = result.to_dict()

        key = subtraction_file_key(legacy_id, filename)

        return self._storage.read(key), file["size"]
