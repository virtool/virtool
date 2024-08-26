from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.uploads.models import UploadType


async def test_finalize(
    fake: DataFaker,
    mongo: Mongo,
    snapshot_recent,
):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
        name="malus.fa.gz",
    )
    subtraction = await fake.subtractions.create(user=user, upload=upload)

    assert subtraction == snapshot_recent(name="obj")
    assert await mongo.subtraction.find_one() == snapshot_recent(name="mongo")
