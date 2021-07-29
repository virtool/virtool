from logging import getLogger
from shutil import copytree
from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from virtool.example import example_path
from virtool.subtractions.files import create_subtraction_files
from virtool.subtractions.utils import FILES
from virtool.subtractions.db import finalize
from virtool.types import App
from virtool.uploads.models import Upload

logger = getLogger(__name__)


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
        gc={
            "a": 0.25,
            "t": 0.25,
            "g": 0.25,
            "c": 0.25
        },
        count=100,
    )
