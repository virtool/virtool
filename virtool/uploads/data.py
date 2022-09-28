from logging import getLogger
from typing import List, Optional, Union

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.models.upload import Upload, UploadMinimal
from virtool_core.utils import rm

import virtool.utils
from virtool.data.errors import ResourceNotFoundError
from virtool.data.piece import DataLayerPiece
from virtool.mongo.core import DB
from virtool.mongo.transforms import apply_transforms
from virtool.uploads.db import finalize
from virtool.uploads.models import Upload as SQLUpload
from virtool.users.db import AttachUserTransform
from virtool.utils import run_in_thread

logger = getLogger(__name__)


class UploadsData(DataLayerPiece):
    def __init__(self, config, db, pg):
        self._config = config
        self._db: DB = db
        self._pg = pg

    async def find(self, user, upload_type, ready) -> List[UploadMinimal]:
        """
        Find and filter uploads.
        """

        filters = [SQLUpload.removed == False]
        uploads = []

        async with AsyncSession(self._pg) as session:
            if user:
                filters.append(SQLUpload.user == user)

            if upload_type:
                filters.append(SQLUpload.type == upload_type)

            if ready is not None:
                filters.append(SQLUpload.ready == ready)

            results = await session.execute(select(SQLUpload).filter(*filters))

        for result in results.unique().scalars().all():
            uploads.append(result.to_dict())

        return [
            UploadMinimal(**upload)
            for upload in await apply_transforms(
                uploads, [AttachUserTransform(self._db)]
            )
        ]

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
            await run_in_thread(
                rm, self._config.data_path / "files" / upload.name_on_disk
            )
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
