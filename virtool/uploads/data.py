from logging import getLogger
from typing import List, Optional, Type

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from virtool_core.models.upload import UploadMinimal

import virtool.utils
from virtool.api.response import NotFound
from virtool.data.piece import DataLayerPiece


from virtool.mongo.core import DB
from virtool.mongo.transforms import apply_transforms
from virtool.pg.base import Base

from virtool.uploads.models import Upload
from virtool.users.db import AttachUserTransform
from virtool.utils import run_in_thread, rm

logger = getLogger(__name__)


class UploadsData(DataLayerPiece):
    def __init__(self, config, db, pg):
        self._config = config
        self._db: DB = db
        self._pg = pg

    async def find(
        self, user: str = None, upload_type: str = None, ready: bool = None
    ) -> List[UploadMinimal]:
        """
        Find and filter uploads.
        """

        filters = [Upload.removed is False]
        uploads = []

        async with AsyncSession(self._pg) as session:
            if user:
                filters.append(Upload.user == user)

            if upload_type:
                filters.append(Upload.type == upload_type)

            if ready is not None:
                filters.append(Upload.ready == ready)

            results = await session.execute(select(Upload).filter(*filters))

        for result in results.unique().scalars().all():
            uploads.append(result.to_dict())

        uploads = await apply_transforms(uploads, [AttachUserTransform(self._db)])

        return [UploadMinimal(**upload) for upload in uploads]

    async def create(
        self,
        name: str,
        upload_type: str,
        reserved: bool = False,
        user: Optional[str] = None,
    ) -> Upload:
        """
        Create an upload.
        """

        async with AsyncSession(self._pg) as session:
            upload = Upload(
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

        return Upload(**upload)

    async def get(self, upload_id: int) -> Optional[Upload]:
        """
        Get a single upload by its ID.

        :param upload_id: the upload's ID
        :return: the upload
        """
        async with AsyncSession(self._pg) as session:
            upload = (
                await session.execute(
                    select(Upload).filter_by(id=upload_id, removed=False)
                )
            ).scalar()

            if not upload:
                return None

        return upload

    async def delete(self, upload_id: int) -> Upload:
        """
        "Delete" a row in the `uploads` table and remove it from the local disk.

        :param upload_id: Row `id` to "delete"
        :return: the upload
        """

        upload = await self.delete_row(upload_id)

        if not upload:
            return None

        try:
            await run_in_thread(
                rm, self._config.data_path / "files" / upload.name_on_disk
            )
        except FileNotFoundError:
            pass

        return upload

    async def delete_row(self, upload_id: int) -> Optional[Upload]:
        """
        Set the `removed` and `removed_at` attributes of the upload in the given row.

        :param pg: PostgreSQL AsyncEngine object
        :param upload_id: Row `id` to set attributes for
        :return: The upload
        """
        async with AsyncSession(self._pg) as session:
            upload = (
                await session.execute(select(Upload).where(Upload.id == upload_id))
            ).scalar()

            if not upload or upload.removed:
                return None

            upload.reads.clear()
            upload.removed = True
            upload.removed_at = virtool.utils.timestamp()

            upload = upload.to_dict()

            await session.commit()

        return Upload(**upload)

    async def finalize(
        self, size: int, id_: int, model: Type[Base]
    ) -> Optional[dict]:
        """
        Finalize row creation for tables that store uploaded files.

        Updates table with file information and sets `ready`    to `True`.

        :param size: Size of a newly uploaded file in bytes
        :param id_: Row `id` corresponding to the recently created `upload` entry
        :param model: model for uploaded file
        :return: Dictionary representation of new row in `table`
        """
        async with AsyncSession(self._pg) as session:
            upload = (await session.execute(select(model).filter_by(id=id_))).scalar()

            if not upload:
                return None

            upload.size = size
            upload.uploaded_at = virtool.utils.timestamp()
            upload.ready = True

            upload = upload.to_dict()

            await session.commit()

        return upload

    async def get_upload_path(self, name_on_disk: str) -> str:
        """
        Get the local upload path and return it.
        """
        upload_path = self._config.data_path / "files" / name_on_disk

        # check if the file has been manually removed by the user
        if not upload_path.exists():
            raise NotFound("Uploaded file not found at expected location")

        return upload_path
