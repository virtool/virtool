import math
import uuid
from collections.abc import AsyncIterator
from datetime import timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emits
from virtool.data.transforms import apply_transforms
from virtool.samples.sql import SQLSampleReads
from virtool.storage.protocol import StorageBackend
from virtool.uploads.models import Upload, UploadSearchResult
from virtool.uploads.sql import SQLUpload, UploadType
from virtool.uploads.utils import upload_file_key
from virtool.users.transforms import AttachUserTransform


def serialize(upload: SQLUpload) -> dict:
    return {
        "id": upload.id,
        "created_at": upload.created_at,
        "name": upload.name,
        "name_on_disk": upload.name_on_disk,
        "ready": upload.ready,
        "removed": upload.removed,
        "removed_at": upload.removed_at,
        "reserved": upload.reserved,
        "size": upload.size,
        "space": upload.space,
        "type": upload.type,
        "uploaded_at": upload.uploaded_at,
        "user": {"id": upload.user_id},
    }


class UploadsData(DataLayerDomain):
    name = "uploads"

    def __init__(self, pg: AsyncEngine, storage: StorageBackend):
        self._pg: AsyncEngine = pg
        self._storage = storage

    async def find(
        self,
        user_id: int | None,
        page: int,
        per_page: int,
        upload_type,
    ) -> UploadSearchResult:
        """Find and filter uploads."""
        base_filters = [
            SQLUpload.ready == True,  # skipcq: PTC-W0068,PYL-R1714
            SQLUpload.removed == False,  # skipcq: PTC-W0068,PYL-R1714
            SQLUpload.reserved == False,  # skipcq: PTC-W0068,PYL-R1714
        ]

        filters = []

        if user_id is not None:
            filters.append(SQLUpload.user_id == user_id)  # skipcq: PTC-W0068,PYL-R1714

        if upload_type:
            filters.append(SQLUpload.type == upload_type)  # skipcq: PTC-W0068,PYL-R1714

        found_query = (
            select(func.count(SQLUpload.id))
            .where(*base_filters, *filters)
            .label("found")
        )

        total_query = (
            select(func.count(SQLUpload.id)).where(*base_filters).label("total")
        )

        skip = 0

        if page > 1:
            skip = (page - 1) * per_page

        async with AsyncSession(self._pg) as session:
            count_result = await session.execute(
                select(
                    found_query,
                    total_query,
                ),
            )

            found_count, total_count = count_result.fetchone()

            query = (
                select(SQLUpload)
                .where(*base_filters, *filters)
                .order_by(SQLUpload.created_at.desc())
                .offset(skip)
                .limit(per_page)
            )

            uploads = [
                serialize(row)
                for row in (await session.execute(query)).unique().scalars()
            ]

        uploads = await apply_transforms(
            uploads, [AttachUserTransform(self._pg)], self._pg
        )

        return UploadSearchResult(
            items=uploads,
            found_count=found_count,
            total_count=total_count,
            page=page,
            page_count=int(math.ceil(found_count / per_page)),
            per_page=per_page,
        )

    @emits(Operation.CREATE)
    async def create(
        self,
        chunker,
        name: str,
        upload_type: UploadType,
        user_id: int,
    ) -> Upload:
        """Create an upload."""
        created_at = virtool.utils.timestamp()
        name_on_disk = f"{uuid.uuid4()}-{name}"

        size = await self._storage.write(
            upload_file_key(name_on_disk),
            chunker,
        )

        async with AsyncSession(self._pg) as session:
            upload = SQLUpload(
                created_at=created_at,
                name=name,
                name_on_disk=name_on_disk,
                ready=True,
                removed=False,
                reserved=False,
                size=size,
                type=upload_type,
                uploaded_at=virtool.utils.timestamp(),
                user_id=user_id,
            )

            session.add(upload)
            await session.commit()
            await session.refresh(upload)

            upload_dict = serialize(upload)

        return Upload(
            **await apply_transforms(
                upload_dict, [AttachUserTransform(self._pg)], self._pg
            ),
        )

    async def get(self, upload_id: int) -> Upload:
        """Get a single upload by its ID.

        :param upload_id: the upload's ID
        :return: the upload
        """
        async with AsyncSession(self._pg) as session:
            upload = (
                await session.execute(
                    select(SQLUpload).filter_by(id=upload_id, removed=False),
                )
            ).scalar()

            if not upload:
                raise ResourceNotFoundError

        return Upload(
            **await apply_transforms(
                serialize(upload),
                [AttachUserTransform(self._pg)],
                self._pg,
            ),
        )

    async def get_upload_file_info(
        self, upload_id: int
    ) -> tuple[AsyncIterator[bytes], int, str]:
        """Get a stream, size, and original name for downloading an upload.

        :param upload_id: the upload's ID
        :return: a tuple of the file stream, size, and original filename
        """
        async with AsyncSession(self._pg) as session:
            upload = (
                await session.execute(
                    select(
                        SQLUpload.name_on_disk, SQLUpload.name, SQLUpload.size
                    ).filter_by(id=upload_id, removed=False),
                )
            ).first()

            if not upload:
                raise ResourceNotFoundError

        key = upload_file_key(upload.name_on_disk)

        return self._storage.read(key), upload.size, upload.name

    @emits(Operation.DELETE)
    async def delete(self, upload_id: int) -> Upload:
        """Delete an upload by its id.

        :param upload_id: The upload id
        :return: the upload
        """
        async with AsyncSession(self._pg) as session:
            upload = (
                await session.execute(
                    select(SQLUpload).where(SQLUpload.id == upload_id),
                )
            ).scalar()

            if not upload or upload.removed:
                raise ResourceNotFoundError

            if upload.reserved:
                raise ResourceConflictError(
                    "Upload is reserved and in use",
                )

            if upload.reads is not None:
                upload.reads.clear()
            upload.removed = True
            upload.removed_at = virtool.utils.timestamp()

            name_on_disk = upload.name_on_disk
            upload = serialize(upload)

            await session.commit()

        upload = Upload(
            **await apply_transforms(upload, [AttachUserTransform(self._pg)], self._pg),
        )

        await self._storage.delete(upload_file_key(name_on_disk))

        return upload

    async def release(self, upload_ids: int | list[int]) -> None:
        """Release the uploads in `upload_ids`.

        The `reserved` field is set to `False`, allowing the uploads to be used for
        sample creation.

        :param upload_ids: List of upload ids
        """
        if isinstance(upload_ids, int):
            query = SQLUpload.id == upload_ids
        else:
            query = SQLUpload.id.in_(upload_ids)

        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLUpload)
                .where(query)
                .values(reserved=False)
                .execution_options(synchronize_session="fetch"),
            )

            await session.commit()

    async def reap_orphaned(self, older_than: timedelta) -> int:
        """Delete reserved uploads that are not linked to any sample.

        A reserved upload with no ``SQLSampleReads`` row is one that was reserved for a
        sample that never finished creation. Such uploads are hidden from the selector
        (``find`` filters ``reserved == False``) and would otherwise be retained
        forever.

        Only uploads older than ``older_than`` are reaped, so reservations made during
        an in-flight sample creation are not deleted before their reads link is written.

        :param older_than: the minimum age an upload must reach to be eligible
        :return: the number of uploads that were reaped
        """
        cutoff = virtool.utils.timestamp() - older_than

        async with AsyncSession(self._pg) as session:
            orphan_ids = (
                (
                    await session.execute(
                        select(SQLUpload.id).where(
                            SQLUpload.reserved == True,  # skipcq: PTC-W0068,PYL-R1714
                            SQLUpload.removed == False,  # skipcq: PTC-W0068,PYL-R1714
                            SQLUpload.created_at < cutoff,
                            ~select(SQLSampleReads.id)
                            .where(SQLSampleReads.upload == SQLUpload.id)
                            .exists(),
                        ),
                    )
                )
                .scalars()
                .all()
            )

        if orphan_ids:
            # ``delete`` refuses reserved uploads, so drop the reservation first.
            await self.release(orphan_ids)

            for upload_id in orphan_ids:
                await self.delete(upload_id)

        return len(orphan_ids)

    async def reserve(
        self,
        upload_ids: int | list[int],
        session: AsyncSession,
    ) -> None:
        """Reserve the uploads in `upload_ids` within the given session.

        The `reserved` field is set to `True`, preventing the uploads from being used
        for sample creation.

        The requested uploads are validated before any are reserved: if any upload is
        missing or already reserved, a :class:`ResourceConflictError` is raised and no
        upload is reserved. The reservation participates in the caller's transaction;
        it is the caller's responsibility to commit ``session``.

        :param upload_ids: an upload id or list of upload ids
        :param session: the PostgreSQL session to reserve within
        :raises ResourceConflictError: if any upload is missing or already reserved
        """
        ids = {upload_ids} if isinstance(upload_ids, int) else set(upload_ids)

        existing = (
            await session.execute(
                select(SQLUpload.id, SQLUpload.reserved).where(SQLUpload.id.in_(ids)),
            )
        ).all()

        if ids - {row.id for row in existing}:
            raise ResourceConflictError("One or more files do not exist")

        if any(row.reserved for row in existing):
            raise ResourceConflictError("One or more files are already reserved")

        # The conditional update and row-count check guard against a concurrent
        # request reserving one of these uploads between the check above and here.
        result = await session.execute(
            update(SQLUpload)
            .where(
                SQLUpload.id.in_(ids),
                SQLUpload.reserved == False,  # skipcq: PTC-W0068,PYL-R1714
            )
            .values(reserved=True)
            .execution_options(synchronize_session=False),
        )

        if result.rowcount != len(ids):
            raise ResourceConflictError("One or more files are already reserved")
