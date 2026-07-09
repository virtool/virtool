"""Tests for the OTU data layer.

TODO: Move detailed side-effect and other testing from the API layer to this module.
TODO: Remove direct database access as much as possible.
TODO: Use `fake` fixture.

"""

from asyncio import gather

import pytest
from syrupy import SnapshotAssertion

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.otus.oas import CreateOTURequest, UpdateOTURequest
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


async def test_get_fasta(mongo, snapshot, test_otu, test_sequence, data_layer):
    await gather(
        mongo.otus.insert_one(
            {
                **test_otu,
                "isolates": [
                    *test_otu["isolates"],
                    {"id": "baz", "source_type": "isolate", "source_name": "A"},
                ],
            },
        ),
        mongo.sequences.insert_many(
            [
                test_sequence,
                {
                    **test_sequence,
                    "_id": "AX12345",
                    "sequence": "ATAGAGGAGTTA",
                    "isolate_id": "baz",
                },
            ],
            session=None,
        ),
    )

    assert await data_layer.otus.get_fasta(test_otu["_id"]) == snapshot


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
    test_otu,
    static_time,
    tmp_path,
    data_layer,
):
    user = await fake.users.create()
    reference = await fake.references.create(user=user)

    test_otu["reference"] = {"id": reference.id}
    test_otu["isolates"].append(
        {"default": False, "id": "bar", "source_type": "isolate", "source_name": "A"},
    )

    await mongo.otus.insert_one(test_otu)

    assert (
        await data_layer.otus.set_isolate_as_default("6116cba1", "bar", user.id)
        == snapshot
    )

    assert await mongo.otus.find_one() == snapshot


async def test_get_sequence_fasta(mongo, data_layer, test_otu, test_sequence):
    await mongo.otus.insert_one(test_otu)
    await mongo.sequences.insert_one(test_sequence)

    assert await data_layer.otus.get_sequence_fasta(test_sequence["_id"]) == (
        "prunus_virus_f.isolate_8816-v2.abcd1234.fa",
        ">Prunus virus F|Isolate 8816-v2|abcd1234|27\nTGTTTAAGAGATTAAACAACCGCTTTC",
    )


async def test_get_isolate_fasta(mongo, data_layer, test_otu, test_sequence):
    await mongo.otus.insert_one(test_otu)

    await mongo.sequences.insert_many(
        [test_sequence, dict(test_sequence, _id="AX12345", sequence="ATAGAGGAGTTA")],
        session=None,
    )

    assert await data_layer.otus.get_isolate_fasta(
        test_otu["_id"],
        test_otu["isolates"][0]["id"],
    ) == (
        "prunus_virus_f.isolate_8816-v2.fa",
        ">Prunus virus F|Isolate 8816-v2|abcd1234|27\nTGTTTAAGAGATTAAACAACCGCTTTC\n"
        ">Prunus virus F|Isolate 8816-v2|AX12345|12\nATAGAGGAGTTA",
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
