"""Tests for the OTU data layer."""

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.identifier import AbstractIdProvider
from virtool.models.enums import Molecule
from virtool.otus.models import OTUSegment
from virtool.otus.oas import CreateOTURequest
from virtool.otus.sql import SQLSequence
from virtool.references.sql import SQLReference
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


async def _set_source_types(
    pg: AsyncEngine,
    reference_id: int,
    *,
    restrict_source_types: bool,
    source_types: list[str],
) -> None:
    """Configure a reference's source type restrictions."""
    async with AsyncSession(pg) as session:
        await session.execute(
            update(SQLReference)
            .where(SQLReference.id == reference_id)
            .values(
                restrict_source_types=restrict_source_types,
                source_types=source_types,
            ),
        )

        await session.commit()


class TestAddIsolateSourceType:
    """The parent reference's source type configuration governs new isolates."""

    async def _create_otu(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        *,
        restrict_source_types: bool,
        source_types: list[str],
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        otu = await fake.otus.create_empty(reference.id, user)

        await _set_source_types(
            pg,
            reference.id,
            restrict_source_types=restrict_source_types,
            source_types=source_types,
        )

        return otu, user

    async def test_allowed_when_restricted(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        otu, user = await self._create_otu(
            fake,
            pg,
            restrict_source_types=True,
            source_types=["isolate", "strain"],
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "Isolate", "8816", user.id)

        assert isolate.source_type == "isolate"

    async def test_disallowed_when_restricted(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        otu, user = await self._create_otu(
            fake,
            pg,
            restrict_source_types=True,
            source_types=["isolate", "strain"],
        )

        with pytest.raises(ResourceConflictError, match="Source type is not allowed"):
            await data_layer.otus.add_isolate(otu.id, "genotype", "8816", user.id)

    async def test_allowed_when_unrestricted(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        otu, user = await self._create_otu(
            fake,
            pg,
            restrict_source_types=False,
            source_types=["isolate"],
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "genotype", "8816", user.id)

        assert isolate.source_type == "genotype"

    async def test_unknown_is_always_allowed(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        otu, user = await self._create_otu(
            fake,
            pg,
            restrict_source_types=True,
            source_types=["isolate"],
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "unknown", "8816", user.id)

        assert isolate.source_type == "unknown"

    async def test_otu_not_found(self, data_layer: DataLayer, fake: DataFaker):
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.otus.add_isolate("missing", "isolate", "8816", user.id)


def _segments(count: int) -> list[OTUSegment]:
    """Compose an OTU schema defining the segments ``RNA_0`` through ``RNA_{count-1}``.

    ``create_sequence`` rejects a segment the parent OTU's schema does not define, so a
    test that names a segment has to give the OTU one that carries it.
    """
    return [
        OTUSegment(molecule=Molecule.ss_rna, name=f"RNA_{index}", required=False)
        for index in range(count)
    ]


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


class TestOTUWrite:
    """The single-OTU write path persists changes, read back through the data layer."""

    async def test_create_persists_otu(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Tobacco mosaic virus", abbreviation="TMV"),
            user.id,
        )

        assert otu.name == "Tobacco mosaic virus"
        assert otu.abbreviation == "TMV"
        assert otu.reference.id == reference.id
        assert otu.verified is False
        assert otu.version == 0

        assert await data_layer.otus.get(otu.id) == otu


class TestIsolateWrite:
    async def test_add_isolate_bumps_version(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Example"),
            user.id,
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "isolate", "A", user.id)

        otu = await data_layer.otus.get(otu.id)

        assert otu.version == 1
        assert [i.id for i in otu.isolates] == [isolate.id]


class TestGeneratedIdCollision:
    """The create paths keep asking for an id until Postgres has a free one.

    The id is needed before the row is written, so it cannot come from
    ``Collection.insert_one``, which used to check Mongo for a collision and generate
    another id. Obeying a generator that returns a taken id would upsert over the row
    that already holds it.
    """

    async def test_create_skips_taken_otu_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        id_provider: AbstractIdProvider,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        taken = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Prunus virus A"),
            user.id,
        )

        mocker.patch.object(
            id_provider,
            "get",
            side_effect=[taken.id, "freshotu"],
        )

        created = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Tobacco mosaic virus"),
            user.id,
        )

        assert created.id == "freshotu"

        # The OTU that held the colliding id is intact rather than overwritten.
        assert (await data_layer.otus.get(taken.id)).name == "Prunus virus A"

    async def test_create_sequence_skips_taken_sequence_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        id_provider: AbstractIdProvider,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Example", schema=_segments(10)),
            user.id,
        )

        isolate = await data_layer.otus.add_isolate(otu.id, "isolate", "A", user.id)

        taken = await data_layer.otus.create_sequence(
            otu.id,
            isolate.id,
            "NC_001367",
            "Example genome",
            "ATGCGTACGT",
            user.id,
        )

        mocker.patch.object(
            id_provider,
            "get",
            side_effect=[taken.id, "freshseq"],
        )

        created = await data_layer.otus.create_sequence(
            otu.id,
            isolate.id,
            "NC_001368",
            "Another genome",
            "TTTTTTTTTT",
            user.id,
        )

        assert created.id == "freshseq"

        # The sequence that held the colliding id keeps its own body.
        sequences = {
            sequence.id: sequence.sequence
            for sequence in (await data_layer.otus.get(otu.id)).isolates[0].sequences
        }

        assert sequences == {taken.id: "ATGCGTACGT", "freshseq": "TTTTTTTTTT"}

    async def test_add_isolate_skips_taken_isolate_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        id_provider: AbstractIdProvider,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Example"),
            user.id,
        )

        taken = await data_layer.otus.add_isolate(otu.id, "isolate", "A", user.id)

        mocker.patch.object(
            id_provider,
            "get",
            side_effect=[taken.id, "freshiso"],
        )

        created = await data_layer.otus.add_isolate(otu.id, "isolate", "B", user.id)

        assert created.id == "freshiso"

        # Both isolates coexist; the colliding id was not reused.
        isolate_ids = {
            isolate.id for isolate in (await data_layer.otus.get(otu.id)).isolates
        }

        assert isolate_ids == {taken.id, "freshiso"}


class TestSequenceWrite:
    """The per-sequence write path writes the sequence row and bumps the parent OTU."""

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

    async def test_create_sequence_persists_and_bumps_otu(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        otu_id, isolate_id, user_id = await self._make_isolate(data_layer, fake)

        version_before = (await data_layer.otus.get(otu_id)).version

        created = await data_layer.otus.create_sequence(
            otu_id,
            isolate_id,
            "NC_001367",
            "Example genome",
            "ATGCGTACGT",
            user_id,
            "host",
            "RNA_2",
        )

        assert created.accession == "NC_001367"
        assert created.segment == "RNA_2"

        otu = await data_layer.otus.get(otu_id)

        assert [sequence.id for sequence in otu.isolates[0].sequences] == [created.id]
        assert otu.version == version_before + 1

    async def test_undefined_segment_rejected(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """A segment the parent OTU's schema does not define is refused."""
        otu_id, isolate_id, user_id = await self._make_isolate(data_layer, fake)

        with pytest.raises(
            ResourceError,
            match="Segment RNA_99 is not defined for the parent OTU",
        ):
            await data_layer.otus.create_sequence(
                otu_id,
                isolate_id,
                "NC_001367",
                "Example genome",
                "ATGCGTACGT",
                user_id,
                "host",
                "RNA_99",
            )


class TestSequencePosition:
    """``legacy_sequences.position`` preserves an OTU's sequence insertion order.

    A joined OTU rebuilt from Postgres feeds ``patch_to_version``, whose stored
    ``dictdiffer`` diffs address an isolate's sequences by list index. If Postgres
    returns them in a different order than they were written, index builds, reference
    clones and analysis formatting all apply each change to the wrong sequence.
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

    async def test_isolates_share_one_position_sequence(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

        assert [row.id for row in rows if row.isolate_id == first_isolate_id] == [
            interleaved[0],
            interleaved[2],
        ]
        assert [row.id for row in rows if row.isolate_id == second_isolate.id] == [
            interleaved[1],
            interleaved[3],
        ]
