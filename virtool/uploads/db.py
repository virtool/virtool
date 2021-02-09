import asyncio
import logging
from pathlib import Path
from typing import Union

from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

import virtool.uploads.utils
import virtool.utils
from virtool.uploads.models import Upload

logger = logging.getLogger("uploads")


async def create(req, pg: AsyncEngine, name: str, upload_type: str, reserved: bool = False,
                 user: Union[None, str] = None) -> dict:
    """
    Writes a new upload to disk and creates a new row in the `uploads` SQL table. Returns a dictionary representation
    of the new row.

    :param req: Request handler object
    :param pg: PostgreSQL database object
    :param name: the name of the upload
    :param upload_type: the type of upload (e.g. reads)
    :param reserved: should the file immediately be reserved (used for legacy samples)
    :param user: the id of the uploading user
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

        file_path = Path(req.app["settings"]["data_path"]) / "files" / upload.name_on_disk

        try:
            size = await virtool.uploads.utils.naive_writer(req, file_path)
        except asyncio.CancelledError:
            logger.debug(f"Upload aborted: {upload.id}")

            await session.delete(upload)
            await session.commit()

            return None

        upload.size = size
        upload.uploaded_at = virtool.utils.timestamp()

        upload = upload.to_dict()

        await session.commit()

        return upload
