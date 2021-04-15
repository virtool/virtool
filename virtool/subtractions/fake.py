from logging import getLogger
from pathlib import Path
from shutil import copytree

from sqlalchemy.ext.asyncio import AsyncSession

import virtool.subtractions.db
from virtool.subtractions.files import create_subtraction_files
from virtool.subtractions.utils import FILES
from virtool.types import App
from virtool.uploads.models import Upload

logger = getLogger(__name__)


async def create_fake_subtractions(app: App, user_id: str):
    """
    Create fake subtractions and their associated uploads and subtraction files.

    Two subtractions are ready for use. One has ``ready`` set to ``False`` and can be used for
    testing subtraction finalization.

    :param app: the application object

    """
    db = app["db"]
    fake = app["fake"]
    pg = app["pg"]

    subtractions_path = Path(app["settings"]["data_path"]) / "subtractions"
    example_path = (
        Path(__file__).parent.parent.parent
        / "example/subtractions/arabidopsis_thaliana"
    )

    copytree(example_path, subtractions_path / "subtraction_1", dirs_exist_ok=True)

    async with AsyncSession(pg) as session:
        upload = Upload(name="test.fa.gz", type="subtraction", user=user_id)

        session.add(upload)
        await session.flush()

        upload_id = upload.id
        upload_name = upload.name

        await session.commit()

    subtraction_1 = await db.subtraction.insert_one(
        {
            "_id": fake.get_mongo_id(),
            "name": "subtraction_1",
            "nickname": "",
            "deleted": False,
            "is_host": True,
            "ready": True,
            "file": {"id": upload_id, "name": upload_name},
            "user": {"id": user_id},
        }
    )

    await virtool.subtractions.db.create(
        db, user_id, upload_name, "subtraction_2", "", upload_id, fake.get_mongo_id()
    )

    await virtool.subtractions.db.create(
        db,
        user_id,
        upload_name,
        "subtraction_unready",
        "",
        upload_id,
        fake.get_mongo_id(),
    )

    await create_subtraction_files(
        pg, subtraction_1["_id"], FILES, subtractions_path / "subtraction_1"
    )

    logger.debug("Created fake subtractions")
