import logging
from typing import Union, Optional, List, Dict, Type

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


async def finalize(pg, size: int, id_: int, table: Type[any]) -> Optional[dict]:
    """
    Finalize row creation for tables that store uploaded files. Updates table with file information and sets `ready`
    to `True`.

    :param pg: PostgreSQL AsyncEngine object
    :param size: Size of the new file in bytes
    :param id_: Row `id` corresponding to the recently created `upload` entry
    :param table: SQL table to retrieve row from
    :return: Dictionary representation of new row in `table`
    """
    uploaded_at = virtool.utils.timestamp()

    async with AsyncSession(pg) as session:
        upload = (await session.execute(select(table).filter_by(id=id_))).scalar()

        if not upload:
            return None

        upload.size = size
        upload.uploaded_at = uploaded_at
        upload.ready = True

        upload = upload.to_dict()

        await session.commit()

    return upload


async def find(pg, user: str = None, upload_type: str = None) -> List[dict]:
    """
    Retrieves a list of `Upload` documents in the `uploads` SQL table. Can be given a list of filters to narrow down
    results.

    :param pg: PostgreSQL AsyncEngine object
    :param user: User id that corresponds to the user that uploaded the file
    :param upload_type: Type of file that was uploaded
    :return: A list of dictionaries that represent each `Upload` document found
    """
    filters = [Upload.removed == False]
    uploads = list()

    async with AsyncSession(pg) as session:
        if user:
            filters.append(Upload.user == user)

        if upload_type:
            filters.append(Upload.type == upload_type)

        results = await session.execute(select(Upload).filter(*filters))

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
        upload = (await session.execute(select(Upload).filter_by(id=upload_id, removed=False))).scalar()

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


async def release(pg: AsyncEngine, upload_ids: Union[int, List[int]]):
    """
    Release the uploads in `upload_ids` by setting the `reserved` field to `False`.

    :param pg: PostgreSQL AsyncEngine object
    :param upload_ids: List of row `id`s to set the attribute for
    """
    if isinstance(upload_ids, int):
        query = (Upload.id == upload_ids)
    else:
        query = (Upload.id.in_(upload_ids))

    async with AsyncSession(pg) as session:
        await session.execute(update(Upload).
                              where(query).values(reserved=False).
                              execution_options(synchronize_session="fetch")
                              )

        await session.commit()


async def reserve(pg: AsyncEngine, upload_ids: Union[int, List[int]]):
    """
    Reserve the uploads in `upload_ids` by setting the `reserved` field to `True`.

    :param pg: PostgreSQL AsyncEngine object
    :param upload_ids: List of row `id`s to set the attribute for
    """
    if isinstance(upload_ids, int):
        query = Upload.id == upload_ids
    else:
        query = Upload.id.in_(upload_ids)

    async with AsyncSession(pg) as session:
        await session.execute(update(Upload).
                              where(query).values(reserved=True).
                              execution_options(synchronize_session="fetch")
                              )

        await session.commit()
