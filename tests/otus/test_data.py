"""Tests for the OTU data layer.

TODO: Move detailed side-effect and other testing from the API layer to this module.
TODO: Remove direct database access as much as possible.
TODO: Use `fake` fixture.

"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.models.enums import Molecule
from virtool.mongo.core import Mongo
from virtool.otus.models import OTUSegment
from virtool.otus.oas import (
    CreateOTURequest,
    UpdateOTURequest,
    UpdateSequenceRequest,
)
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.references.oas import UpdateReferenceRequest
from virtool.workflow.pytest_plugin.utils import StaticTime


@pytest.mark.parametrize(
    "data",
    [
        CreateOTURequest(abbreviation="TMV", name="Tobacco mosaic virus"),
        CreateOTURequest(name="Prunus virus A"),
    ],
    ids=["full", "no_abbreviation"],
)
async def test_create(
    data: CreateOTURequest,
    data_layer: DataLayer,
    fake: DataFaker,
    snapshot: SnapshotAssertion,
    static_time: StaticTime,
):
    user = await fake.users.create()
    reference = await fake.references.create(user=user)

    otu = await data_layer.otus.create(reference.id, data, user.id)

    assert otu == snapshot(name="return_value")

    otu = await data_layer.otus.get(otu.id)

    assert otu == snapshot(name="otu")
    assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
        name="history",
    )


async def test_get_fasta(data_layer: DataLayer, fake: DataFaker):
    """The OTU FASTA export gathers every isolate's sequences from Postgres."""
    user = await fake.users.create()
    reference = await fake.references.create(user=user)

    otu = await data_layer.otus.create(
        reference.id,
        CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
        user.id,
    )

    first_isolate = await data_layer.otus.add_isolate(
        otu.id, "isolate", "8816-v2", user.id
    )
    second_isolate = await data_layer.otus.add_isolate(
        otu.id, "isolate", "7865", user.id
    )

    first_sequence = await data_layer.otus.create_sequence(
        otu.id,
        first_isolate.id,
        "KX269872",
        "Prunus virus F segment RNA2",
        "TGTTTAAGAGATTAAACAACCGCTTTC",
        user.id,
        "sweet cherry",
    )

    second_sequence = await data_layer.otus.create_sequence(
        otu.id,
        second_isolate.id,
        "AX12345",
        "Prunus virus F segment RNA1",
        "ATAGAGGAGTTA",
        user.id,
        "sweet cherry",
    )

    assert await data_layer.otus.get_fasta(otu.id) == (
        "prunus_virus_f.fa",
        f">Prunus virus F|Isolate 8816-v2|{first_sequence.id}|27\n"
        "TGTTTAAGAGATTAAACAACCGCTTTC\n"
        f">Prunus virus F|Isolate 7865|{second_sequence.id}|12\n"
        "ATAGAGGAGTTA",
    )


async def test_update(
    data_layer: DataLayer,
    fake: DataFaker,
    snapshot: SnapshotAssertion,
    static_time: StaticTime,
):
    user = await fake.users.create()
    reference = await fake.references.create(user=user)

    otu = await fake.otus.create(reference.id, user)

    updated_otu = await data_layer.otus.update(
        otu.id,
        UpdateOTURequest(abbreviation="TMV", name="Tobacco mosaic virus"),
        user.id,
    )

    assert updated_otu.name == "Tobacco mosaic virus"
    assert updated_otu.abbreviation == "TMV"
    assert updated_otu.version == otu.version + 1
    assert updated_otu == snapshot(name="return_value")

    # Return value should be the same as the object returned from get().
    assert await data_layer.otus.get(otu.id) == updated_otu

    assert await data_layer.history.get(updated_otu.most_recent_change.id) == snapshot(
        name="history",
    )


async def test_set_default(
    mongo,
    snapshot,
    fake,
    insert_otu,
    test_otu,
    static_time,
    tmp_path,
    data_layer,
):
    user = await fake.users.create()
    reference = await fake.references.create(user=user)

    test_otu["isolates"].append(
        {"default": False, "id": "bar", "source_type": "isolate", "source_name": "A"},
    )

    await insert_otu(test_otu, reference.id)

    assert (
        await data_layer.otus.set_isolate_as_default("6116cba1", "bar", user.id)
        == snapshot
    )

    assert await mongo.otus.find_one() == snapshot


async def test_get_sequence_fasta(data_layer: DataLayer, fake: DataFaker):
    """The single-sequence FASTA export reads its body from Postgres."""
    user = await fake.users.create()
    reference = await fake.references.create(user=user)

    otu = await data_layer.otus.create(
        reference.id,
        CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
        user.id,
    )

    isolate = await data_layer.otus.add_isolate(otu.id, "isolate", "8816-v2", user.id)

    sequence = await data_layer.otus.create_sequence(
        otu.id,
        isolate.id,
        "KX269872",
        "Prunus virus F segment RNA2",
        "TGTTTAAGAGATTAAACAACCGCTTTC",
        user.id,
        "sweet cherry",
    )

    assert await data_layer.otus.get_sequence_fasta(sequence.id) == (
        f"prunus_virus_f.isolate_8816-v2.{sequence.id}.fa",
        f">Prunus virus F|Isolate 8816-v2|{sequence.id}|27\nTGTTTAAGAGATTAAACAACCGCTTTC",
    )


async def test_get_isolate_fasta(data_layer: DataLayer, fake: DataFaker):
    """The isolate FASTA export reads every sequence body from Postgres, in order."""
    user = await fake.users.create()
    reference = await fake.references.create(user=user)

    otu = await data_layer.otus.create(
        reference.id,
        CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
        user.id,
    )

    isolate = await data_layer.otus.add_isolate(otu.id, "isolate", "8816-v2", user.id)

    first_sequence = await data_layer.otus.create_sequence(
        otu.id,
        isolate.id,
        "KX269872",
        "Prunus virus F segment RNA2",
        "TGTTTAAGAGATTAAACAACCGCTTTC",
        user.id,
        "sweet cherry",
    )

    second_sequence = await data_layer.otus.create_sequence(
        otu.id,
        isolate.id,
        "AX12345",
        "Prunus virus F segment RNA1",
        "ATAGAGGAGTTA",
        user.id,
        "sweet cherry",
    )

    assert await data_layer.otus.get_isolate_fasta(otu.id, isolate.id) == (
        "prunus_virus_f.isolate_8816-v2.fa",
        f">Prunus virus F|Isolate 8816-v2|{first_sequence.id}|27\n"
        "TGTTTAAGAGATTAAACAACCGCTTTC\n"
        f">Prunus virus F|Isolate 8816-v2|{second_sequence.id}|12\n"
        "ATAGAGGAGTTA",
    )


class TestAddIsolateSourceType:
    """The parent reference's source type configuration governs new isolates."""

    async def _create_otu(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        *,
        restrict_source_types: bool,
        source_types: list[str],
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        otu = await fake.otus.create_empty(reference.id, user)

        await data_layer.references.update(
            reference.id,
            UpdateReferenceRequest(
                restrict_source_types=restrict_source_types,
                source_types=source_types,
            ),
        )

        return otu, user

    async def test_allowed_when_restricted(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        otu, user = await self._create_otu(
            data_layer,
            fake,
            restrict_source_types=True,
            source_types=["isolate", "strain"],
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "Isolate", "8816", user.id)

        assert isolate.source_type == "isolate"

    async def test_disallowed_when_restricted(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        otu, user = await self._create_otu(
            data_layer,
            fake,
            restrict_source_types=True,
            source_types=["isolate", "strain"],
        )

        with pytest.raises(ResourceConflictError, match="Source type is not allowed"):
            await data_layer.otus.add_isolate(otu.id, "genotype", "8816", user.id)

    async def test_allowed_when_unrestricted(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        otu, user = await self._create_otu(
            data_layer,
            fake,
            restrict_source_types=False,
            source_types=["isolate"],
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "genotype", "8816", user.id)

        assert isolate.source_type == "genotype"

    async def test_unknown_is_always_allowed(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        otu, user = await self._create_otu(
            data_layer,
            fake,
            restrict_source_types=True,
            source_types=["isolate"],
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "unknown", "8816", user.id)

        assert isolate.source_type == "unknown"

    async def test_otu_not_found(self, data_layer: DataLayer, fake: DataFaker):
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.otus.add_isolate("missing", "isolate", "8816", user.id)


class TestUpdateIsolateSourceType:
    async def test_disallowed_when_restricted(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        otu = await fake.otus.create(reference.id, user)

        await data_layer.references.update(
            reference.id,
            UpdateReferenceRequest(
                restrict_source_types=True,
                source_types=["isolate"],
            ),
        )

        isolate_id = otu.isolates[0].id

        with pytest.raises(ResourceConflictError, match="Source type is not allowed"):
            await data_layer.otus.update_isolate(
                otu.id,
                isolate_id,
                user.id,
                source_type="genotype",
            )

    async def test_source_name_only_skips_check(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """A rename that leaves ``source_type`` alone is not source type checked."""
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        otu = await fake.otus.create(reference.id, user)

        await data_layer.references.update(
            reference.id,
            UpdateReferenceRequest(
                restrict_source_types=True,
                source_types=["strain"],
            ),
        )

        isolate = await data_layer.otus.update_isolate(
            otu.id,
            otu.isolates[0].id,
            user.id,
            source_name="Renamed",
        )

        assert isolate["source_name"] == "Renamed"


def _segments(count: int) -> list[OTUSegment]:
    """Compose an OTU schema defining the segments ``RNA_0`` through ``RNA_{count-1}``.

    ``create_sequence`` and ``update_sequence`` reject a segment the parent OTU's schema
    does not define, so a test that names a segment has to give the OTU one that carries
    it.
    """
    return [
        OTUSegment(molecule=Molecule.ss_rna, name=f"RNA_{index}", required=False)
        for index in range(count)
    ]


async def _get_otu_row(pg: AsyncEngine, otu_id: str) -> SQLOTU | None:
    async with AsyncSession(pg) as session:
        return (
            await session.execute(select(SQLOTU).where(SQLOTU.id == otu_id))
        ).scalar_one_or_none()


async def _get_sequence_rows(pg: AsyncEngine, otu_id: str) -> list[SQLSequence]:
    """Get an OTU's sequence rows in the order Postgres would join them."""
    async with AsyncSession(pg) as session:
        return list(
            (
                await session.execute(
                    select(SQLSequence)
                    .where(SQLSequence.otu_id == otu_id)
                    .order_by(SQLSequence.position),
                )
            ).scalars(),
        )


async def _get_mongo_sequence_ids(mongo: Mongo, otu_id: str) -> list[str]:
    """Get an OTU's sequence ids in the natural order ``join`` reads them in."""
    return [
        document["_id"]
        async for document in mongo.sequences.find(
            {"otu_id": otu_id},
            projection=["_id"],
        )
    ]


class TestOTUDualWrite:
    """The single-OTU write path mirrors Mongo into the ``legacy_otus`` table."""

    async def test_create_writes_row(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Tobacco mosaic virus", abbreviation="TMV"),
            user.id,
        )

        row = await _get_otu_row(pg, otu.id)

        assert row is not None
        assert row.name == "Tobacco mosaic virus"
        assert row.abbreviation == "TMV"
        assert row.reference_id == reference.id
        assert row.verified is False
        assert row.version == 0
        assert row.data["_id"] == otu.id
        assert row.data["name"] == "Tobacco mosaic virus"

    async def test_update_syncs_row(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Old name", abbreviation="ON"),
            user.id,
        )

        await data_layer.otus.update(
            otu.id,
            UpdateOTURequest(name="New name"),
            user.id,
        )

        row = await _get_otu_row(pg, otu.id)

        assert row.name == "New name"
        assert row.version == 1
        assert row.verified is False
        assert row.data["name"] == "New name"

    async def test_remove_deletes_row_and_sequences(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await fake.otus.create(reference.id, user)

        assert await _get_otu_row(pg, otu.id) is not None
        assert await _get_sequence_rows(pg, otu.id)

        await data_layer.otus.remove(otu.id, user.id)

        assert await _get_otu_row(pg, otu.id) is None
        assert await _get_sequence_rows(pg, otu.id) == []


class TestIsolateDualWrite:
    async def test_add_isolate_bumps_version(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Example"),
            user.id,
        )

        await data_layer.otus.add_isolate(otu.id, "isolate", "A", user.id)

        row = await _get_otu_row(pg, otu.id)

        assert row.version == 1
        assert len(row.data["isolates"]) == 1

    async def test_remove_isolate_deletes_its_sequences(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await fake.otus.create(reference.id, user)
        isolate_id = otu.isolates[0].id

        assert await _get_sequence_rows(pg, otu.id)

        await data_layer.otus.remove_isolate(otu.id, isolate_id, user.id)

        assert await _get_sequence_rows(pg, otu.id) == []
        assert await _get_otu_row(pg, otu.id) is not None


class TestSequenceDualWrite:
    """The per-sequence write path mirrors both the sequence row and the parent OTU."""

    async def _make_isolate(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ) -> tuple[str, str, int]:
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Example", schema=_segments(10)),
            user.id,
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "isolate", "A", user.id)

        return otu.id, isolate.id, user.id

    async def test_create_sequence_writes_row_and_bumps_otu(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        otu_id, isolate_id, user_id = await self._make_isolate(data_layer, fake)

        version_before = (await _get_otu_row(pg, otu_id)).version

        await data_layer.otus.create_sequence(
            otu_id,
            isolate_id,
            "NC_001367",
            "Example genome",
            "ATGCGTACGT",
            user_id,
            "host",
            "RNA_2",
        )

        rows = await _get_sequence_rows(pg, otu_id)

        assert len(rows) == 1
        assert rows[0].otu_id == otu_id
        assert rows[0].isolate_id == isolate_id
        assert rows[0].segment == "RNA_2"
        assert rows[0].data["accession"] == "NC_001367"

        assert (await _get_otu_row(pg, otu_id)).version == version_before + 1

    async def test_update_sequence_syncs_row(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        otu_id, isolate_id, user_id = await self._make_isolate(data_layer, fake)

        await data_layer.otus.create_sequence(
            otu_id,
            isolate_id,
            "NC_001367",
            "Example genome",
            "ATGCGTACGT",
            user_id,
            "host",
            "RNA_1",
        )

        [row] = await _get_sequence_rows(pg, otu_id)
        version_before = (await _get_otu_row(pg, otu_id)).version

        await data_layer.otus.update_sequence(
            otu_id,
            isolate_id,
            row.id,
            user_id,
            UpdateSequenceRequest(segment="RNA_2"),
        )

        [row] = await _get_sequence_rows(pg, otu_id)

        assert row.segment == "RNA_2"
        assert row.data["segment"] == "RNA_2"
        assert (await _get_otu_row(pg, otu_id)).version == version_before + 1

    async def test_remove_sequence_deletes_row_and_bumps_otu(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        otu_id, isolate_id, user_id = await self._make_isolate(data_layer, fake)

        await data_layer.otus.create_sequence(
            otu_id,
            isolate_id,
            "NC_001367",
            "Example genome",
            "ATGCGTACGT",
            user_id,
            "host",
            "RNA_1",
        )

        [row] = await _get_sequence_rows(pg, otu_id)
        version_before = (await _get_otu_row(pg, otu_id)).version

        await data_layer.otus.remove_sequence(otu_id, isolate_id, row.id, user_id)

        assert await _get_sequence_rows(pg, otu_id) == []
        assert (await _get_otu_row(pg, otu_id)).version == version_before + 1


class TestSequencePosition:
    """``legacy_sequences.position`` reproduces Mongo's natural sequence order.

    A joined OTU rebuilt from Postgres feeds ``patch_to_version``, whose stored
    ``dictdiffer`` diffs address an isolate's sequences by list index. If Postgres
    returns them in a different order than Mongo does, index builds, reference clones
    and analysis formatting all apply each change to the wrong sequence.
    """

    async def _make_isolate(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ) -> tuple[str, str, int]:
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Example", schema=_segments(10)),
            user.id,
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "isolate", "A", user.id)

        return otu.id, isolate.id, user.id

    async def _create_sequences(
        self,
        data_layer: DataLayer,
        otu_id: str,
        isolate_id: str,
        user_id: int,
        count: int,
    ) -> list[str]:
        return [
            (
                await data_layer.otus.create_sequence(
                    otu_id,
                    isolate_id,
                    f"NC_00000{index}",
                    f"Segment {index}",
                    "ATGCGTACGT",
                    user_id,
                    "host",
                    f"RNA_{index}",
                )
            ).id
            for index in range(count)
        ]

    async def test_create_sequence_appends(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Each new sequence is appended to the end of its OTU."""
        otu_id, isolate_id, user_id = await self._make_isolate(data_layer, fake)

        sequence_ids = await self._create_sequences(
            data_layer,
            otu_id,
            isolate_id,
            user_id,
            3,
        )

        rows = await _get_sequence_rows(pg, otu_id)

        assert [row.position for row in rows] == [0, 1, 2]
        assert [row.id for row in rows] == sequence_ids

    async def test_update_sequence_preserves_order(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Editing a sequence must not move it within its OTU.

        The regression this column exists for. An update rewrites the row, which
        moves its tuple to the end of the Postgres heap, so an unordered read would
        hand the OTU's sequences back in a new order.
        """
        otu_id, isolate_id, user_id = await self._make_isolate(data_layer, fake)

        sequence_ids = await self._create_sequences(
            data_layer,
            otu_id,
            isolate_id,
            user_id,
            3,
        )

        await data_layer.otus.update_sequence(
            otu_id,
            isolate_id,
            sequence_ids[1],
            user_id,
            UpdateSequenceRequest(sequence="TTTTTTTTTT"),
        )

        rows = await _get_sequence_rows(pg, otu_id)

        assert [row.position for row in rows] == [0, 1, 2]
        assert [row.id for row in rows] == sequence_ids
        assert [row.id for row in rows] == await _get_mongo_sequence_ids(mongo, otu_id)

    async def test_remove_sequence_leaves_a_gap(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """A removed sequence is not renumbered over, and the next one still appends.

        Only relative order matters, so gaps are harmless. Reusing a freed position
        would not be.
        """
        otu_id, isolate_id, user_id = await self._make_isolate(data_layer, fake)

        sequence_ids = await self._create_sequences(
            data_layer,
            otu_id,
            isolate_id,
            user_id,
            3,
        )

        await data_layer.otus.remove_sequence(
            otu_id,
            isolate_id,
            sequence_ids[1],
            user_id,
        )

        rows = await _get_sequence_rows(pg, otu_id)

        assert [row.position for row in rows] == [0, 2]
        assert [row.id for row in rows] == [sequence_ids[0], sequence_ids[2]]

        appended = await data_layer.otus.create_sequence(
            otu_id,
            isolate_id,
            "NC_000009",
            "Appended",
            "ATGCGTACGT",
            user_id,
            "host",
            "RNA_9",
        )

        rows = await _get_sequence_rows(pg, otu_id)

        assert [row.position for row in rows] == [0, 2, 3]
        assert rows[-1].id == appended.id
        assert [row.id for row in rows] == await _get_mongo_sequence_ids(mongo, otu_id)

    async def test_schema_change_preserves_order(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Dropping a segment re-mirrors every sequence without reordering them.

        ``update`` unsets ``segment`` on sequences whose segment left the schema and
        re-writes each of the OTU's rows. That upsert must not renumber them.
        """
        otu_id, isolate_id, user_id = await self._make_isolate(data_layer, fake)

        await data_layer.otus.update(
            otu_id,
            UpdateOTURequest(
                schema=[
                    {"name": "RNA_0", "molecule": "ssRNA", "required": True},
                    {"name": "RNA_1", "molecule": "ssRNA", "required": True},
                    {"name": "RNA_2", "molecule": "ssRNA", "required": True},
                ],
            ),
            user_id,
        )

        sequence_ids = await self._create_sequences(
            data_layer,
            otu_id,
            isolate_id,
            user_id,
            3,
        )

        await data_layer.otus.update(
            otu_id,
            UpdateOTURequest(
                schema=[{"name": "RNA_0", "molecule": "ssRNA", "required": True}],
            ),
            user_id,
        )

        rows = await _get_sequence_rows(pg, otu_id)

        assert [row.position for row in rows] == [0, 1, 2]
        assert [row.id for row in rows] == sequence_ids
        assert [row.id for row in rows] == await _get_mongo_sequence_ids(mongo, otu_id)
        assert [row.segment for row in rows] == ["RNA_0", None, None]

    async def test_isolates_share_one_position_sequence(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """``position`` numbers an OTU's sequences, not each isolate's separately.

        ``merge_otu`` filters one OTU-wide sequence list into each isolate, so what a
        diff indexes into is the OTU's order narrowed to an isolate. A per-isolate
        counter would collide across isolates and lose that.
        """
        otu_id, first_isolate_id, user_id = await self._make_isolate(data_layer, fake)

        second_isolate = await data_layer.otus.add_isolate(
            otu_id,
            "isolate",
            "B",
            user_id,
        )

        interleaved = [
            (
                await data_layer.otus.create_sequence(
                    otu_id,
                    isolate_id,
                    f"NC_00001{index}",
                    f"Segment {index}",
                    "ATGCGTACGT",
                    user_id,
                    "host",
                    f"RNA_{index}",
                )
            ).id
            for index, isolate_id in enumerate(
                [
                    first_isolate_id,
                    second_isolate.id,
                    first_isolate_id,
                    second_isolate.id,
                ],
            )
        ]

        rows = await _get_sequence_rows(pg, otu_id)

        assert [row.position for row in rows] == [0, 1, 2, 3]
        assert [row.id for row in rows] == interleaved
        assert [row.id for row in rows] == await _get_mongo_sequence_ids(mongo, otu_id)

        assert [row.id for row in rows if row.isolate_id == first_isolate_id] == [
            interleaved[0],
            interleaved[2],
        ]
        assert [row.id for row in rows if row.isolate_id == second_isolate.id] == [
            interleaved[1],
            interleaved[3],
        ]
