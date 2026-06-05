import virtool.subtractions.db
from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker
from virtool.subtractions.db import (
    AttachSubtractionsTransform,
    get_missing_subtraction_ids,
    unlink_default_subtractions,
)
from virtool.uploads.sql import UploadType


class TestAttachSubtractions:
    async def test_single(self, fake: DataFaker, pg, snapshot):
        """Test attaching a single subtraction."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user, upload_type=UploadType.subtraction, name="foobar.fq.gz"
        )

        subtraction_ids = [
            subtraction.id
            for subtraction in [
                await fake.subtractions.create(user=user, upload=upload)
                for _ in range(2)
            ]
        ]

        documents = {"id": "sub_1", "subtractions": subtraction_ids}
        result = await apply_transforms(
            documents, [AttachSubtractionsTransform(pg)], pg
        )
        assert result == snapshot

    async def test_multiple(self, fake: DataFaker, pg, snapshot):
        """Test attaching multiple subtractions."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user, upload_type=UploadType.subtraction, name="foobar.fq.gz"
        )

        subtraction_ids = [
            subtraction.id
            for subtraction in [
                await fake.subtractions.create(user=user, upload=upload)
                for _ in range(2)
            ]
        ]

        documents = [
            {"id": "sub_1", "subtractions": subtraction_ids},
            {"id": "sub_2", "subtractions": [subtraction_ids[0]]},
            {"id": "sub_3", "subtractions": []},
        ]
        result = await apply_transforms(
            documents, [AttachSubtractionsTransform(pg)], pg
        )
        assert result == snapshot


class TestGetMissingSubtractionIds:
    async def test_all_exist(self, fake: DataFaker, pg):
        """No ids are reported missing when every subtraction exists."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user, upload_type=UploadType.subtraction, name="foobar.fq.gz"
        )

        subtraction = await fake.subtractions.create(user=user, upload=upload)

        assert await get_missing_subtraction_ids(pg, [subtraction.id]) == set()

    async def test_some_missing(self, fake: DataFaker, pg):
        """Only the non-existent ids are returned, unchanged."""
        user = await fake.users.create()
        upload = await fake.uploads.create(
            user=user, upload_type=UploadType.subtraction, name="foobar.fq.gz"
        )

        subtraction = await fake.subtractions.create(user=user, upload=upload)

        assert await get_missing_subtraction_ids(
            pg, [subtraction.id, "does_not_exist"]
        ) == {"does_not_exist"}

    async def test_empty(self, pg):
        """An empty input yields an empty set without querying."""
        assert await get_missing_subtraction_ids(pg, []) == set()


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
