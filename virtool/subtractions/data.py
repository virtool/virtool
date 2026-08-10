from asyncio import CancelledError
from collections.abc import AsyncGenerator

from sqlalchemy import delete, select, update
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
from virtool.storage.cleanup import delete_keys
from virtool.storage.keys import mint_storage_key
from virtool.storage.protocol import StorageBackend
from virtool.subtractions.db import (
    attach_computed,
    map_subtraction_row,
)
from virtool.subtractions.models import Subtraction, SubtractionFile
from virtool.subtractions.oas import (
    CreateSubtractionRequest,
    FinalizeSubtractionRequest,
)
from virtool.subtractions.pg import SQLSubtraction, SQLSubtractionFile
from virtool.subtractions.utils import (
    FILES,
    check_subtraction_file_type,
)
from virtool.uploads.db import AttachUploadTransform
from virtool.uploads.sql import SQLUpload
from virtool.users.transforms import AttachUserTransform

logger = get_logger("subtractions")


class SubtractionsData(DataLayerDomain):
    name = "subtractions"

    def __init__(
        self,
        pg: AsyncEngine,
        storage: StorageBackend,
    ):
        self._pg = pg
        self._storage = storage

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
            )

            subtraction.job_id = job.id

            await session.commit()

        return await self.get(new_subtraction_id)

    async def _check_exists(self, subtraction_id: int) -> None:
        """Raise ResourceNotFoundError unless a live subtraction has this id."""
        async with AsyncSession(self._pg) as session:
            exists = (
                await session.execute(
                    select(SQLSubtraction.id).where(
                        SQLSubtraction.id == subtraction_id,
                        SQLSubtraction.deleted.is_(False),
                    ),
                )
            ).one_or_none()

        if exists is None:
            raise ResourceNotFoundError

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

            storage_keys = [
                key
                for key in (
                    await pg_session.execute(
                        select(SQLSubtractionFile.storage_key).where(
                            SQLSubtractionFile.subtraction_id == subtraction_id,
                        ),
                    )
                ).scalars()
                if key is not None
            ]

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

        for key, exc in await delete_keys(self._storage, storage_keys):
            logger.error(
                "storage cleanup failed; file orphaned",
                subtraction_id=subtraction_id,
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
        await self._check_exists(subtraction_id)

        if filename not in FILES:
            raise ResourceNotFoundError("Unsupported subtraction file name")

        file_type = check_subtraction_file_type(filename)

        key = mint_storage_key("subtractions", subtraction_id)

        async with AsyncSession(self._pg) as session:
            subtraction_file = SQLSubtractionFile(
                name=filename,
                subtraction_id=subtraction_id,
                storage_key=key,
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
            download_url=f"/subtractions/{subtraction_id}/files/{filename}",
        )

    async def get_file(self, subtraction_id: int, filename: str):
        await self._check_exists(subtraction_id)

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

        if not result or result.storage_key is None:
            raise ResourceNotFoundError

        file = result.to_dict()

        return self._storage.read(result.storage_key), file["size"]
