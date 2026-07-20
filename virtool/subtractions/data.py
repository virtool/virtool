import math
from asyncio import CancelledError
from collections.abc import AsyncGenerator

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.utils
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emits
from virtool.data.transforms import apply_transforms
from virtool.jobs.transforms import AttachJobTransform
from virtool.pg.utils import get_row_by_id
from virtool.samples.sql import SQLLegacySampleSubtraction
from virtool.storage.cleanup import delete_prefix
from virtool.storage.protocol import StorageBackend
from virtool.subtractions.db import (
    attach_computed,
    map_subtraction_row,
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
        pg: AsyncEngine,
        storage: StorageBackend,
    ):
        self._base_url = base_url
        self._pg = pg
        self._storage = storage

    async def find(
        self,
        find: str | None,
        short: bool,
        ready: bool,
        page: int,
        per_page: int,
    ):
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
                            SQLSubtraction.id,
                            SQLSubtraction.name,
                            SQLSubtraction.ready,
                        )
                        .where(*filters)
                        .order_by(SQLSubtraction.name, SQLSubtraction.id),
                    )
                ).all()

            return [
                {"id": id_, "name": name, "ready": is_ready}
                for id_, name, is_ready in rows
            ]

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
            [map_subtraction_row(subtraction, upload) for subtraction, upload in rows],
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
    ) -> Subtraction:
        """Create a new subtraction.

        :param data: a subtraction creation request
        :param user_id: the id of the creating user
        :return: the subtraction
        """
        upload = await get_row_by_id(self._pg, SQLUpload, data.upload_id)

        if upload is None:
            raise ResourceNotFoundError("Upload does not exist")

        created_at = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            subtraction = SQLSubtraction(
                legacy_id=None,
                name=data.name,
                nickname=data.nickname,
                count=None,
                gc=None,
                created_at=created_at,
                deleted=False,
                ready=False,
                user_id=user_id,
                upload_id=data.upload_id,
            )

            session.add(subtraction)
            await session.flush()

            new_subtraction_id = subtraction.id

            job = await self.data.jobs.create(
                "create_subtraction",
                {"subtraction_id": new_subtraction_id},
                user_id,
                0,
            )

            subtraction.job_id = job.id

            await session.commit()

        return await self.get(new_subtraction_id)

    async def _resolve_storage_id(self, subtraction_id: int) -> str:
        """Return the storage-key identifier for a subtraction.

        Pre-migration subtractions store files under their legacy Mongo slug; ones
        created natively in Postgres (``legacy_id`` is NULL) store under the integer
        id. Raises ResourceNotFoundError if no subtraction matches.
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLSubtraction.id, SQLSubtraction.legacy_id).where(
                        SQLSubtraction.id == subtraction_id,
                        SQLSubtraction.deleted.is_(False),
                    ),
                )
            ).one_or_none()

        if row is None:
            raise ResourceNotFoundError

        return row.legacy_id or str(row.id)

    async def get(self, subtraction_id: int) -> Subtraction:
        """Get a subtraction by its id."""
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLSubtraction, SQLUpload)
                    .outerjoin(SQLUpload, SQLSubtraction.upload_id == SQLUpload.id)
                    .where(
                        SQLSubtraction.id == subtraction_id,
                        SQLSubtraction.deleted.is_(False),
                    ),
                )
            ).first()

        if row is None:
            raise ResourceNotFoundError

        subtraction, upload = row

        document = await attach_computed(
            self._pg,
            self._base_url,
            subtraction.id,
            map_subtraction_row(subtraction, upload),
        )

        document = await apply_transforms(
            document,
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
        subtraction_id: int,
        data: UpdateSubtractionRequest,
    ) -> Subtraction:
        data = data.dict(exclude_unset=True)

        values = {}

        if "name" in data:
            values["name"] = data["name"]

        if "nickname" in data:
            values["nickname"] = data["nickname"]

        if not values:
            return await self.get(subtraction_id)

        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLSubtraction)
                .where(
                    SQLSubtraction.id == subtraction_id,
                    SQLSubtraction.deleted.is_(False),
                )
                .values(**values),
            )
            await session.commit()

        return await self.get(subtraction_id)

    async def delete(self, subtraction_id: int):
        async with AsyncSession(self._pg) as pg_session:
            row = (
                await pg_session.execute(
                    select(
                        SQLSubtraction.id,
                        SQLSubtraction.legacy_id,
                        SQLSubtraction.deleted,
                    ).where(SQLSubtraction.id == subtraction_id),
                )
            ).one_or_none()

            if row is None or row.deleted:
                raise ResourceNotFoundError

            storage_id = row.legacy_id or str(row.id)

            result = await pg_session.execute(
                update(SQLSubtraction)
                .where(SQLSubtraction.id == subtraction_id)
                .values(deleted=True),
            )

            # Unlink this subtraction as a default subtraction on any samples.
            await pg_session.execute(
                delete(SQLLegacySampleSubtraction).where(
                    SQLLegacySampleSubtraction.subtraction_id == subtraction_id,
                ),
            )

            deleted_count = result.rowcount

            await pg_session.commit()

        failures = await delete_prefix(self._storage, subtraction_prefix(storage_id))

        for key, exc in failures:
            logger.error(
                "storage cleanup failed; file orphaned",
                subtraction_id=storage_id,
                key=key,
                error=repr(exc),
            )

        return deleted_count

    @emits(Operation.UPDATE)
    async def finalize(
        self,
        subtraction_id: int,
        data: FinalizeSubtractionRequest,
    ) -> Subtraction:
        """Finalize a subtraction.

        This sets values for the `results` and `gc` fields and switches the `ready`
        field to `true`.

        :param subtraction_id:
        :param data:
        :return: finalized subtraction
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                update(SQLSubtraction)
                .where(
                    SQLSubtraction.id == subtraction_id,
                    SQLSubtraction.deleted.is_(False),
                    SQLSubtraction.ready.is_(False),
                )
                .values(**data.dict(), ready=True),
            )

            if result.rowcount == 0:
                row = (
                    await session.execute(
                        select(SQLSubtraction.deleted).where(
                            SQLSubtraction.id == subtraction_id,
                        ),
                    )
                ).one_or_none()

                if row is None or row.deleted:
                    raise ResourceNotFoundError

                raise ResourceConflictError("Subtraction has already been finalized")

            await session.commit()

        return await self.get(subtraction_id)

    async def upload_file(
        self,
        subtraction_id: int,
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
        storage_id = await self._resolve_storage_id(subtraction_id)

        if filename not in FILES:
            raise ResourceNotFoundError("Unsupported subtraction file name")

        file_type = check_subtraction_file_type(filename)

        key = subtraction_file_key(storage_id, filename)

        async with AsyncSession(self._pg) as session:
            subtraction_file = SQLSubtractionFile(
                name=filename,
                subtraction_id=subtraction_id,
                type=file_type,
            )

            session.add(subtraction_file)

            try:
                await session.flush()
            except IntegrityError:
                raise ResourceConflictError("File name already exists")

            try:
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
            **{**subtraction_file_dict, "subtraction": subtraction_id},
            download_url=f"{self._base_url}/subtractions/{subtraction_id}/files/{filename}",
        )

    async def get_file(self, subtraction_id: int, filename: str):
        storage_id = await self._resolve_storage_id(subtraction_id)

        if filename not in FILES:
            raise ResourceNotFoundError

        async with AsyncSession(self._pg) as session:
            result = (
                await session.execute(
                    select(SQLSubtractionFile).filter_by(
                        subtraction_id=subtraction_id,
                        name=filename,
                    ),
                )
            ).scalar()

        if not result:
            raise ResourceNotFoundError

        file = result.to_dict()

        key = subtraction_file_key(storage_id, filename)

        return self._storage.read(key), file["size"]
