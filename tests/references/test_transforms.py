import datetime

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker
from virtool.references.sql import SQLReference
from virtool.references.transforms import AttachReferenceTransform


async def _seed_reference(pg: AsyncEngine, legacy_id: str | None, user_id: int) -> int:
    async with AsyncSession(pg) as session:
        reference = SQLReference(
            legacy_id=legacy_id,
            name="Reference A",
            description="",
            created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
            source_types=[],
            user_id=user_id,
        )
        session.add(reference)
        await session.flush()
        reference_id = reference.id
        await session.commit()

    return reference_id


class TestAttachReferenceTransform:
    async def test_legacy_string_id(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A document embedding the legacy string id resolves against Postgres.

        The attached nested reference is keyed by the integer primary key regardless
        of which id form the document embeds.
        """
        user = await fake.users.create()
        reference_id = await _seed_reference(pg, "legacy_reference", user.id)

        document = await apply_transforms(
            {"id": "6116cba1", "reference": {"id": "legacy_reference"}},
            [AttachReferenceTransform(pg)],
            pg,
        )

        assert document["reference"] == {
            "id": reference_id,
            "name": "Reference A",
            "data_type": "genome",
        }

    async def test_integer_primary_key(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A document embedding the integer primary key resolves against Postgres."""
        user = await fake.users.create()
        reference_id = await _seed_reference(pg, "legacy_reference", user.id)

        document = await apply_transforms(
            {"id": "6116cba1", "reference": {"id": reference_id}},
            [AttachReferenceTransform(pg)],
            pg,
        )

        assert document["reference"] == {
            "id": reference_id,
            "name": "Reference A",
            "data_type": "genome",
        }

    async def test_native_reference(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A reference with no legacy id resolves by its primary key."""
        user = await fake.users.create()
        reference_id = await _seed_reference(pg, None, user.id)

        document = await apply_transforms(
            {"id": "6116cba1", "reference": {"id": reference_id}},
            [AttachReferenceTransform(pg)],
            pg,
        )

        assert document["reference"] == {
            "id": reference_id,
            "name": "Reference A",
            "data_type": "genome",
        }

    async def test_many_mixed_ids(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A batch mixing legacy string and integer ids resolves every document."""
        user = await fake.users.create()
        reference_id = await _seed_reference(pg, "legacy_reference", user.id)

        documents = await apply_transforms(
            [
                {"id": "string_ref", "reference": {"id": "legacy_reference"}},
                {"id": "integer_ref", "reference": {"id": reference_id}},
            ],
            [AttachReferenceTransform(pg)],
            pg,
        )

        expected = {
            "id": reference_id,
            "name": "Reference A",
            "data_type": "genome",
        }

        assert {d["id"]: d["reference"] for d in documents} == {
            "string_ref": expected,
            "integer_ref": expected,
        }
