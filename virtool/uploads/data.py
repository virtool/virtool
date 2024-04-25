import asyncio
import math
from asyncio import to_thread
from typing import List

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.upload import Upload, UploadMinimal, UploadSearchResult
from virtool_core.utils import rm

import virtool.utils
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceNotFoundError
from virtool.data.events import Operation, emits
from virtool.data.transforms import apply_transforms
from virtool.mongo.core import Mongo
from virtool.uploads.models import SQLUpload, UploadType
from virtool.uploads.utils import naive_writer
from virtool.users.transforms import AttachUserTransform


class UploadsData(DataLayerDomain):
    name = "uploads"

    def __init__(self, config, mongo: "Mongo", pg):
        self._config = config
        self._mongo: Mongo = mongo
        self._pg: AsyncEngine = pg

    async def find(
        self,
        user,
        page: int,
        per_page: int,
        upload_type,
        paginate,
    ) -> List[UploadMinimal] | UploadSearchResult:
        """Find and filter uploads."""
        if paginate:
            return await self._find_beta(user, page, per_page, upload_type)

        filters = [
            SQLUpload.removed == False,  # skipcq: PTC-W0068,PYL-R1714
            SQLUpload.ready == True,  # skipcq: PTC-W0068,PYL-R1714
        ]

        uploads = []

        async with AsyncSession(self._pg) as session:
            if user:
                filters.append(SQLUpload.user == user)

            if upload_type:
                filters.append(SQLUpload.type == upload_type)

            results = await session.execute(
                select(SQLUpload).where(*filters).order_by(SQLUpload.created_at.desc()),
            )

            for result in results.unique().scalars().all():
                uploads.append(result.to_dict())

            return [
                UploadMinimal(**upload)
                for upload in await apply_transforms(
                    uploads,
                    [AttachUserTransform(self._mongo)],
                )
            ]

    async def _find_beta(
        self,
        user,
        page: int,
        per_page: int,
        upload_type,
    ) -> UploadSearchResult:
        base_filters = [
            SQLUpload.ready == True,  # skipcq: PTC-W0068,PYL-R1714
            SQLUpload.removed == False,  # skipcq: PTC-W0068,PYL-R1714
            SQLUpload.reserved == False,  # skipcq: PTC-W0068,PYL-R1714
        ]

        filters = []

        if user:
            filters.append(SQLUpload.user == user)  # skipcq: PTC-W0068,PYL-R1714

        if upload_type:
            filters.append(SQLUpload.type == upload_type)  # skipcq: PTC-W0068,PYL-R1714

        total_query = (
            select(func.count(SQLUpload.id).label("total"))
            .where(*base_filters)
            .subquery()
        )

        found_query = (
            select(func.count(SQLUpload.id).label("found"))
            .where(*base_filters, *filters)
            .subquery()
        )

        skip = 0

        if page > 1:
            skip = (page - 1) * per_page

        async with AsyncSession(self._pg) as session:
            query = (
                select(SQLUpload)
                .where(*base_filters, *filters)
                .order_by(SQLUpload.created_at.desc())
                .offset(skip)
                .limit(per_page)
            )

            total_count_results, found_count_results, results = await asyncio.gather(
                session.execute(select(total_query)),
                session.execute(select(found_query)),
                session.execute(query),
            )

            total_count = total_count_results.scalar()
            found_count = found_count_results.scalar()

            uploads = [row.to_dict() for row in results.unique().scalars()]

        uploads = await apply_transforms(uploads, [AttachUserTransform(self._mongo)])

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
        user: str | None = None,
    ) -> Upload:
        """Create an upload."""
        uploads_path = self._config.data_path / "files"

        await asyncio.to_thread(uploads_path.mkdir, parents=True, exist_ok=True)

        async with AsyncSession(self._pg) as session:
            upload = SQLUpload(
                created_at=virtool.utils.timestamp(),
                name=name,
                ready=True,
                removed=False,
                reserved=False,
                type=upload_type,
                uploaded_at=virtool.utils.timestamp(),
                user=user,
            )

            session.add(upload)

            await session.flush()

            upload.name_on_disk = f"{upload.id}-{upload.name}"

            size = await naive_writer(chunker, uploads_path / upload.name_on_disk)

            upload.size = size
            upload_dict = upload.to_dict()

            await session.commit()

        return Upload(
            **await apply_transforms(upload_dict, [AttachUserTransform(self._mongo)]),
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
                upload.to_dict(),
                [AttachUserTransform(self._mongo)],
            ),
        )

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

            upload.reads.clear()
            upload.removed = True
            upload.removed_at = virtool.utils.timestamp()

            upload = upload.to_dict()

            await session.commit()

        upload = Upload(
            **await apply_transforms(upload, [AttachUserTransform(self._mongo)]),
        )

        try:
            await to_thread(rm, self._config.data_path / "files" / upload.name_on_disk)
        except FileNotFoundError:
            pass

        return upload

    async def release(self, upload_ids: int | List[int]):
        """Release the uploads in `upload_ids` by setting the `reserved` field to
        `False`.

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

    async def reserve(self, upload_ids: int | List[int]):
        """Reserve the uploads in `upload_ids` by setting the `reserved` field to
        `True`.

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
                .values(reserved=True)
                .execution_options(synchronize_session="fetch"),
            )
            await session.commit()

    async def migrate_to_postgres(self):
        """Transforms documents in the `files` collection into rows in the `uploads` SQL
        table.

        """
        async for document in self._mongo.files.find():
            async with AsyncSession(self._pg) as session:
                exists = (
                    await session.execute(
                        select(SQLUpload).filter_by(name_on_disk=document["_id"]),
                    )
                ).scalar()

                if not exists:
                    upload = SQLUpload(
                        name=document["name"],
                        name_on_disk=document["_id"],
                        ready=document["ready"],
                        removed=False,
                        reserved=document["reserved"],
                        size=document["size"],
                        type=document["type"],
                        user=document["user"]["id"],
                        uploaded_at=document["uploaded_at"],
                    )

                    session.add(upload)
                    await session.commit()

                    await self._mongo.files.delete_one({"_id": document["_id"]})
