from sqlalchemy.ext.asyncio import AsyncSession

import virtool.subtractions.db
from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker
from virtool.samples.sql import SQLLegacySample, SQLLegacySampleSubtraction
from virtool.subtractions.db import (
    AttachSubtractionsTransform,
    get_missing_subtraction_ids,
)
from virtool.uploads.sql import UploadType
from virtool.utils import timestamp


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


async def test_get_linked_samples(fake: DataFaker, pg):
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user, upload_type=UploadType.subtraction, name="foobar.fq.gz"
    )
    subtraction = await fake.subtractions.create(user=user, upload=upload)
    other = await fake.subtractions.create(user=user, upload=upload)

    target = subtraction.id

    linked_ids = []

    async with AsyncSession(pg) as session:
        for legacy_id, name, subtraction_ids in [
            ("sample_with_target", "Sample With Target", [other.id, target]),
            ("another_with_target", "Another With Target", [target]),
            ("sample_without_target", "Sample Without Target", [other.id]),
        ]:
            sample = SQLLegacySample(
                legacy_id=legacy_id,
                name=name,
                library_type="normal",
                created_at=timestamp(),
                user_id=user.id,
            )
            session.add(sample)
            await session.flush()

            for subtraction_id in subtraction_ids:
                session.add(
                    SQLLegacySampleSubtraction(
                        sample_id=sample.id,
                        subtraction_id=subtraction_id,
                    ),
                )

            if target in subtraction_ids:
                linked_ids.append(sample.id)

        await session.commit()

    samples = await virtool.subtractions.db.get_linked_samples(pg, target)

    assert samples == [
        {"id": linked_ids[0], "name": "Sample With Target"},
        {"id": linked_ids[1], "name": "Another With Target"},
    ]
