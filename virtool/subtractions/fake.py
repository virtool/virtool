from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.mongo.utils import get_mongo_from_app
from virtool.types import App
from virtool.uploads.models import SQLUpload, UploadType


async def create_fake_fasta_upload(app: App, user_id: str) -> Tuple[int, str]:
    async with AsyncSession(app["pg"]) as session:
        upload = SQLUpload(name="test.fa.gz", type="subtraction", user=user_id)

        session.add(upload)
        await session.flush()

        upload_id = upload.id
        upload_name = upload.name

        await session.commit()

    return upload_id, upload_name


async def create_fake_finalized_subtraction(
    app: App,
) -> None:
    """Create a finalized subtraction in the database and file system.

    :param app: the application object
    """
    layer = get_data_from_app(app)
    mongo = get_mongo_from_app(app)
    pg = app["pg"]

    fake = DataFaker(layer, mongo, pg)

    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
        name="foobar.fq.gz",
    )

    await fake.subtractions.create(user=user, upload=upload)
