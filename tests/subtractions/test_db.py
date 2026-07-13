import virtool.subtractions.db
from virtool.data.layer import DataLayer
from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker
from virtool.samples.oas import UpdateSampleRequest
from virtool.subtractions.db import (
    AttachSubtractionsTransform,
    get_missing_subtraction_ids,
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

        assert await get_missing_subtraction_ids(pg, [subtraction.id, 999999]) == {
            999999
        }

    async def test_empty(self, pg):
        """An empty input yields an empty set without querying."""
        assert await get_missing_subtraction_ids(pg, []) == set()


async def test_get_linked_samples(data_layer: DataLayer, fake: DataFaker, pg):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user, upload_type=UploadType.subtraction, name="foobar.fq.gz"
    )
    target = await fake.subtractions.create(user=user, upload=upload)
    other = await fake.subtractions.create(user=user, upload=upload)

    sample_with_target = await fake.samples.create(user)
    await data_layer.samples.update(
        sample_with_target.id,
        UpdateSampleRequest(subtractions=[other.id, target.id]),
    )

    another_with_target = await fake.samples.create(user)
    await data_layer.samples.update(
        another_with_target.id,
        UpdateSampleRequest(subtractions=[target.id]),
    )

    sample_without_target = await fake.samples.create(user)
    await data_layer.samples.update(
        sample_without_target.id,
        UpdateSampleRequest(subtractions=[other.id]),
    )

    samples = await virtool.subtractions.db.get_linked_samples(pg, target.id)

    assert samples == [
        {"id": sample_with_target.id, "name": sample_with_target.name},
        {"id": another_with_target.id, "name": another_with_target.name},
    ]
