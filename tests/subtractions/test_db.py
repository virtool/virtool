from virtool.fake.next import DataFaker
import virtool.subtractions.db
from virtool.uploads.models import UploadType
from virtool.data.transforms import apply_transforms
from virtool.subtractions.db import (
    AttachSubtractionsTransform,
    unlink_default_subtractions,
)


async def test_attach_subtractions(fake: DataFaker, mongo, snapshot):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user, upload_type=UploadType.subtraction, name="foobar.fq.gz"
    )

    subtraction_ids = [
        subtraction.id
        for subtraction in [
            await fake.subtractions.create(user=user, upload=upload) for _ in range(2)
        ]
    ]

    documents = [
        {"id": "sub_1", "subtractions": subtraction_ids},
        [
            {"id": "sub_1", "subtractions": subtraction_ids},
            {"id": "sub_2", "subtractions": [subtraction_ids[0]]},
            {"id": "sub_3", "subtractions": []},
        ],
    ]

    for document in documents:
        result = await apply_transforms(document, [AttachSubtractionsTransform(mongo)])

        assert result == snapshot


async def test_get_linked_samples(fake: DataFaker, mongo):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user, upload_type=UploadType.subtraction, name="foobar.fq.gz"
    )
    subtraction = await fake.subtractions.create(user=user, upload=upload)

    await mongo.samples.insert_many(
        [
            {"_id": "foo", "name": "Foo", "subtractions": ["1", subtraction.id, "3"]},
            {"_id": "bar", "name": "Bar", "subtractions": ["2", subtraction.id, "8"]},
            {"_id": "baz", "name": "Baz", "subtractions": ["2"]},
        ],
        session=None,
    )

    samples = await virtool.subtractions.db.get_linked_samples(mongo, subtraction.id)

    assert samples == [{"id": "foo", "name": "Foo"}, {"id": "bar", "name": "Bar"}]


async def test_unlink_default_subtractions(fake: DataFaker, mongo):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
        name="foobar.fq.gz",
    )

    subtraction = await fake.subtractions.create(user=user, upload=upload)

    await mongo.samples.insert_many(
        [
            {"_id": "foo", "subtractions": ["1", subtraction.id, "3"]},
            {"_id": "bar", "subtractions": [subtraction.id, "5", "8"]},
            {"_id": "baz", "subtractions": [subtraction.id]},
        ],
        session=None,
    )

    async with mongo.create_session() as session:
        await unlink_default_subtractions(mongo, subtraction.id, session)

    assert await mongo.samples.find().to_list(None) == [
        {"_id": "foo", "subtractions": ["1", "3"]},
        {"_id": "bar", "subtractions": ["5", "8"]},
        {"_id": "baz", "subtractions": []},
    ]
