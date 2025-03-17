from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.transforms import AbstractTransform
from virtool.pg.base import Base
from virtool.pg.utils import get_row_by_id
from virtool.types import Document
from virtool.uploads.models import SQLUpload


class AttachUploadTransform(AbstractTransform):
    """Attaches an upload to a document that has an upload field."""

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Document):
        return {**document, "upload": prepared}

    async def prepare_one(self, document: Document):
        try:
            upload_id = document["upload"]
        except KeyError:
            return None

        return await get_row_by_id(self._pg, SQLUpload, upload_id)

    async def prepare_many(self, documents: list[Document]) -> dict[int, dict]:
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUpload).where(
                    SQLUpload.id.in_(
                        list({document["upload"] for document in documents}),
                    ),
                ),
            )

            uploads = {upload.id: dict(upload) for upload in result.scalars()}

        return {
            document["_id"]: uploads.get(document["upload"]) for document in documents
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
