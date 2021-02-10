import datetime
import logging
from typing import Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.uploads.utils
import virtool.utils
from virtool.uploads.models import Upload

logger = logging.getLogger("uploads")


async def create(pg, name: str, upload_type: str, reserved: bool = False,
                 user: Union[None, str] = None) -> dict:
    """
    Writes a new upload to disk and creates a new row in the `uploads` SQL table. Returns a dictionary representation
    of the new row.

    :param pg: PostgreSQL client
    :param name: The name of the upload
    :param upload_type: The type of upload (e.g. reads)
    :param reserved: Whether the file should immediately be reserved (used for legacy samples)
    :param user: The id of the uploading user
    :return: Dictionary representation of new row in the `uploads` SQL table
    """
    async with AsyncSession(pg) as session:
        upload = Upload(
            created_at=virtool.utils.timestamp(),
            name=name,
            ready=False,
            removed=False,
            reserved=reserved,
            type=upload_type,
            user=user
        )

        session.add(upload)

        await session.flush()

        upload.name_on_disk = f"{upload.id}-{upload.name}"

        upload = upload.to_dict()

        await session.commit()

        return upload


async def finalize(pg, size: int, upload_id: int, uploaded_at: datetime):
    """
    Finalize `upload` entry creation after the file has been uploaded locally.

    :param pg: PostgreSQL client
    :param size: Size of the new file in bytes
    :param upload_id: Row `id` corresponding to the recently created `upload` entry
    :param uploaded_at: Timestamp from when the file was uploaded
    :return: Dictionary representation of new row in the `uploads` SQL table
    """
    async with AsyncSession(pg) as session:
        upload = (await session.execute(select(Upload).filter(Upload.id == upload_id))).scalar()

        if not upload:
            return None

        upload.size = size
        upload.uploaded_at = uploaded_at

        upload = upload.to_dict()

        await session.commit()

        return upload


async def find(pg, filters):
    uploads = list()

    async with AsyncSession(pg) as session:
        query = select(Upload)

        if filters:
            query = query.filter(*filters)

        results = await session.execute(query)

    for result in results.scalars().all():
        uploads.append(result.to_dict())

    return uploads
