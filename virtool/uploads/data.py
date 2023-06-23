import asyncio
import math
from asyncio import to_thread
from logging import getLogger
from typing import List, Optional, Union

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from virtool_core.models.upload import Upload, UploadSearchResult, UploadMinimal
from virtool_core.utils import rm

import virtool.utils
from virtool.data.errors import ResourceNotFoundError
from virtool.data.piece import DataLayerPiece
from virtool.mongo.core import Mongo
from virtool.mongo.transforms import apply_transforms
from virtool.uploads.db import finalize
from virtool.uploads.models import SQLUpload
from virtool.users.db import AttachUserTransform

logger = getLogger("uploads")


class UploadsData(DataLayerPiece):
    def __init__(self, config, db, pg):
        self._config = config
        self._db: Mongo = db
        self._pg: AsyncEngine = pg

    async def find(
        self, user, page: int, per_page: int, upload_type, paginate
    ) -> Union[List[UploadMinimal], UploadSearchResult]:
        """
        Find and filter uploads.
        """

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
                select(SQLUpload).filter(*filters).order_by(SQLUpload.created_at.desc())
            )

            for result in results.unique().scalars().all():
                uploads.append(result.to_dict())

            return [
                UploadMinimal(**upload)
                for upload in await apply_transforms(
                    uploads, [AttachUserTransform(self._db)]
                )
            ]

    async def _find_beta(
        self, user, page: int, per_page: int, upload_type
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
            .filter(*base_filters)
            .subquery()
        )

        found_query = (
            select(func.count(SQLUpload.id).label("found"))
            .filter(*base_filters, *filters)
            .subquery()
        )

        skip = 0

        if page > 1:
            skip = (page - 1) * per_page

        async with AsyncSession(self._pg) as session:
            query = (
                select(SQLUpload)
                .filter(*base_filters, *filters)
                .order_by(SQLUpload.created_at.desc())
                .offset(skip)
                .limit(per_page)
            )

            count, results = await asyncio.gather(
                session.execute(select(total_query, found_query)),
                session.execute(query),
            )

            total_count = 0
            found_count = 0

            count = count.unique().all()

            if count:
                total_count = count[0].total
                found_count = count[0].found

            uploads = [row.to_dict() for row in results.unique().scalars()]

        uploads = await apply_transforms(uploads, [AttachUserTransform(self._db)])

        return UploadSearchResult(
            items=uploads,
            found_count=found_count,
            total_count=total_count,
            page=page,
            page_count=int(math.ceil(found_count / per_page)),
            per_page=per_page,
        )

    async def create(
        self,
        name: str,
        upload_type: str,
        reserved: bool,
        user: Optional[str] = None,
    ) -> Upload:
        """
        Create an upload.
        """

        async with AsyncSession(self._pg) as session:
            upload = SQLUpload(
                created_at=virtool.utils.timestamp(),
                name=name,
                ready=False,
                removed=False,
                reserved=reserved,
                type=upload_type,
                user=user,
            )

            session.add(upload)

            await session.flush()

            upload.name_on_disk = f"{upload.id}-{upload.name}"

            upload = upload.to_dict()

            await session.commit()

        return Upload(**await apply_transforms(upload, [AttachUserTransform(self._db)]))

    async def get(self, upload_id: int) -> Upload:
        """
        Get a single upload by its ID.

        :param upload_id: the upload's ID
        :return: the upload
        """
        async with AsyncSession(self._pg) as session:
            upload = (
                await session.execute(
                    select(SQLUpload).filter_by(id=upload_id, removed=False)
                )
            ).scalar()

            if not upload:
                raise ResourceNotFoundError

        return Upload(
            **await apply_transforms(upload.to_dict(), [AttachUserTransform(self._db)])
        )

    async def delete(self, upload_id: int) -> Upload:
        """
        Delete an upload by its id.

        :param upload_id: The upload id
        :return: the upload
        """

        async with AsyncSession(self._pg) as session:
            upload = (
                await session.execute(
                    select(SQLUpload).where(SQLUpload.id == upload_id)
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
            **await apply_transforms(upload, [AttachUserTransform(self._db)])
        )

        try:
            await to_thread(rm, self._config.data_path / "files" / upload.name_on_disk)
        except FileNotFoundError:
            pass

        return upload

    async def finalize(self, size: int, id_: int) -> Optional[Upload]:
        """
        Finalize an upload by marking it as ready.

        :param size: Size of the newly uploaded file in bytes
        :param id_: id of the upload
        :return: The upload
        """
        upload = await finalize(self._pg, size, id_, SQLUpload)

        return Upload(**await apply_transforms(upload, [AttachUserTransform(self._db)]))

    async def release(self, upload_ids: Union[int, List[int]]):
        """
        Release the uploads in `upload_ids` by setting the `reserved` field to `False`.

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
                .execution_options(synchronize_session="fetch")
            )

            await session.commit()

    async def reserve(self, upload_ids: Union[int, List[int]]):
        """
        Reserve the uploads in `upload_ids` by setting the `reserved` field to `True`.

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
                .execution_options(synchronize_session="fetch")
            )
            await session.commit()

    async def migrate_to_postgres(self):
        """
        Transforms documents in the `files` collection into rows in the `uploads` SQL
        table.

        """
        async for document in self._db.files.find():
            async with AsyncSession(self._pg) as session:
                exists = (
                    await session.execute(
                        select(SQLUpload).filter_by(name_on_disk=document["_id"])
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

                    await self._db.files.delete_one({"_id": document["_id"]})
