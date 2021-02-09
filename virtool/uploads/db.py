from typing import Union

from sqlalchemy.ext.asyncio import AsyncSession

import virtool.utils
from virtool.uploads.models import Upload


async def create(db, name: str, upload_type: str, reserved: bool = False, user: Union[None, str] = None):
    """
    Creates and commits a new upload document

    :param db: PostgreSQL database object
    :param name: the name of the upload
    :param upload_type: the type of upload (e.g. reads)
    :param reserved: should the file immediately be reserved (used for legacy samples)
    :param user: the id of the uploading user
    :return: a JSON response document
    """
    async with AsyncSession(db) as session:
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
        upload = upload.to_dict()

        await session.commit()

        return upload
