import datetime
import logging
from typing import Union, Optional, List, Dict

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

import virtool.uploads.utils
import virtool.utils
from virtool.uploads.models import Upload

logger = logging.getLogger("uploads")


async def create(pg: AsyncEngine, name: str, upload_type: str, reserved: bool = False,
                 user: Union[None, str] = None) -> Dict[str, any]:
    """
    Creates a new row in the `uploads` SQL table. Returns a dictionary representation
    of the new row.

    :param pg: PostgreSQL AsyncEngine object
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


async def finalize(pg: AsyncEngine, size: int, upload_id: int, uploaded_at: datetime) -> Optional[dict]:
    """
    Finalize `Upload` entry creation after the file has been uploaded locally.

    :param pg: PostgreSQL AsyncEngine object
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
        upload.ready = True

        upload = upload.to_dict()

        await session.commit()

        return upload


async def find(pg, filters: List[bool] = None) -> List[dict]:
    """
    Retrieves a list of `Upload` documents in the `uploads` SQL table. Can be given a list of filters to narrow down
    results.

    :param pg: PostgreSQL AsyncEngine object
    :param filters: List of optional queries to filter results through
    :return: A list of dictionaries that represent each `Upload` document found
    """
    uploads = list()

    async with AsyncSession(pg) as session:
        query = select(Upload)

        if filters:
            query = query.filter(*filters)

        results = await session.execute(query)

    for result in results.scalars().all():
        uploads.append(result.to_dict())

    return uploads


async def get(pg: AsyncEngine, upload_id: int) -> Optional[Upload]:
    """
    Retrieve in a row in the SQL `uploads` table by its associated `id`.

    :param pg: PostgreSQL AsyncEngine object
    :param upload_id: Row `id` to retrieve
    :return: An row from the `uploads` table
    """
    async with AsyncSession(pg) as session:
        upload = (await session.execute(select(Upload).filter_by(id=upload_id))).scalar()

        if not upload:
            return None

        return upload


async def delete(pg: AsyncEngine, upload_id: int) -> Optional[dict]:
    """
    Set the `removed` and `removed_at` attributes in the given row. Returns a dictionary representation of that row.

    :param pg: PostgreSQL AsyncEngine object
    :param upload_id: Row `id` to set attributes for
    :return: A dictionary representation of the updated row
    """
    async with AsyncSession(pg) as session:
        upload = (await session.execute(select(Upload).where(Upload.id == upload_id))).scalar()

        if not upload or upload.removed:
            return None

        upload.removed = True
        upload.removed_at = virtool.utils.timestamp()

        upload = upload.to_dict()

        await session.commit()

    return upload


async def reserve(pg, upload_ids):
    """
    Reserve the uploads identified in `upload_ids` by setting the `reserved` field to `True`.

    :param pg: PostgreSQL AsyncEngine object
    :param upload_ids: List of row `id`s to set the attribute for
    """
    async with AsyncSession(pg) as session:
        await session.execute(update(Upload).
                              where(Upload.id.in_(upload_ids)).values(reserve=True).
                              execution_options(synchronize_session="fetch")
                              )
