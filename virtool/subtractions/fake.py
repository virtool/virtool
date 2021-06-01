from logging import getLogger
from shutil import copytree
from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

import virtool.subtractions.db
from virtool.example import example_path
from virtool.fake.identifiers import USER_ID
from virtool.fake.wrapper import FakerWrapper
from virtool.subtractions.db import finalize
from virtool.subtractions.files import create_subtraction_files
from virtool.subtractions.utils import FILES
from virtool.types import App
from virtool.uploads.models import Upload

logger = getLogger(__name__)


async def create_fake_subtractions(app: App):
    """
    Create fake subtractions and their associated uploads and subtraction files.

    Two subtractions are ready for use. One has ``ready`` set to ``False`` and can be used for
    testing subtraction finalization.

    :param app: the application object

    """
    db = app["db"]
    fake: FakerWrapper = app["fake"]

    upload_id, upload_name = await create_fake_fasta_upload(app, USER_ID)

    await create_fake_finalized_subtraction(
        app,
        upload_id,
        upload_name,
        fake.get_mongo_id(),
        USER_ID
    )

    await virtool.subtractions.db.create(
        db,
        USER_ID,
        upload_name,
        "subtraction_2",
        "",
        upload_id,
        fake.get_mongo_id()
    )

    await virtool.subtractions.db.create(
        db,
        USER_ID,
        upload_name,
        "subtraction_unready",
        "",
        upload_id,
        fake.get_mongo_id(),
    )

    logger.debug("Created fake subtractions")


async def create_fake_fasta_upload(app: App, user_id: str) -> Tuple[int, str]:
    async with AsyncSession(app["pg"]) as session:
        upload = Upload(name="test.fa.gz", type="subtraction", user=user_id)

        session.add(upload)
        await session.flush()

        upload_id = upload.id
        upload_name = upload.name

        await session.commit()

    return upload_id, upload_name


async def create_fake_finalized_subtraction(
        app: App,
        upload_id: int,
        upload_name: str,
        subtraction_id: str,
        user_id: str
):
    db = app["db"]
    pg = app["pg"]

    document = await db.subtraction.insert_one({
        "_id": subtraction_id,
        "name": "subtraction_1",
        "nickname": "",
        "deleted": False,
        "is_host": True,
        "ready": True,
        "file": {"id": upload_id, "name": upload_name},
        "user": {"id": user_id},
    })

    subtractions_path = (
            app["settings"]["data_path"] 
            / "subtractions" 
            / subtraction_id.replace(" ", "_").lower()
    )

    subtractions_example_path = example_path / "subtractions" / "arabidopsis_thaliana"

    copytree(subtractions_example_path, subtractions_path, dirs_exist_ok=True)

    await create_subtraction_files(
        pg,
        document["_id"],
        FILES,
        subtractions_path
    )

    return await finalize(
        db,
        pg,
        subtraction_id,
        {
            "a": 0.25,
            "t": 0.25,
            "g": 0.25,
            "c": 0.25
        }
    )
