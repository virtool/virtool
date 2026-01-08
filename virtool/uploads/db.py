from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.pg.base import Base
from virtool.types import Document
from virtool.uploads.sql import SQLUpload
from virtool.users.transforms import AttachUserTransform


class AttachUploadTransform(AbstractTransform):
    """Attaches an upload to a document that has an upload field."""

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Document):
        return {**document, "upload": prepared}

    async def prepare_one(self, document: Document, session: AsyncSession):
        upload_id = document.get("upload")

        if upload_id is None:
            return None

        result = await session.execute(
            select(SQLUpload).where(SQLUpload.id == upload_id),
        )
        upload = result.scalar()

        if not upload:
            return None

        upload_dicts = await apply_transforms(
            [upload.to_dict()],
            [AttachUserTransform(self._pg, ignore_errors=True)],
            self._pg,
        )

        return upload_dicts[0]

    async def prepare_many(
        self, documents: list[Document], session: AsyncSession
    ) -> dict[str, dict | None]:
        upload_ids = {
            document.get("upload")
            for document in documents
            if document.get("upload") is not None
        }

        if not upload_ids:
            return {document["id"]: None for document in documents}

        result = await session.execute(
            select(SQLUpload).where(SQLUpload.id.in_(list(upload_ids))),
        )

        upload_dicts = [upload.to_dict() for upload in result.scalars()]

        upload_dicts = await apply_transforms(
            upload_dicts,
            [AttachUserTransform(self._pg, ignore_errors=True)],
            self._pg,
        )

        uploads_by_id = {u["id"]: u for u in upload_dicts}

        return {
            document["id"]: uploads_by_id.get(document.get("upload"))
            for document in documents
        }


async def finalize(pg, size: int, id_: int, model: type[Base]) -> dict | None:
    """Finalize row creation for tables that store uploaded files.

    Updates table with file information and sets `ready`    to `True`.

    :param pg: PostgreSQL AsyncEngine object
    :param size: Size of a newly uploaded file in bytes
    :param id_: Row `id` corresponding to the recently created `upload` entry
    :param model: model for uploaded file
    :return: Dictionary representation of new row in `table`
    """
    async with AsyncSession(pg) as session:
        upload = (await session.execute(select(model).filter_by(id=id_))).scalar()

        if not upload:
            return None

        upload.size = size
        upload.uploaded_at = virtool.utils.timestamp()
        upload.ready = True

        upload = upload.to_dict()

        await session.commit()

    return upload
