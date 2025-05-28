"""Tests for the OTU data layer.

TODO: Move detailed side-effect and other testing from the API layer to this module.
TODO: Remove direct database access as much as possible.
TODO: Use `fake` fixture.

"""

import asyncio
from asyncio import gather

import pytest
from syrupy import SnapshotAssertion

from tests.fixtures.core import StaticTime
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.otus.oas import OTUCreateRequest, OTUUpdateRequest, SequenceUpdateRequest


@pytest.mark.parametrize(
    "data",
    [
        OTUCreateRequest(abbreviation="TMV", name="Tobacco mosaic virus"),
        OTUCreateRequest(name="Prunus virus A"),
    ],
    ids=["full", "no_abbreviation"],
)
async def test_create(
    data: OTUCreateRequest,
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    static_time: StaticTime,
    test_ref: dict,
):
    user = await fake.users.create()
    await mongo.references.insert_one(test_ref)

    otu = await data_layer.otus.create(test_ref["_id"], data, user.id)

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


@pytest.mark.parametrize(
    "data",
    [OTUUpdateRequest(abbreviation="TMV", name="Tobacco mosaic virus")],
)
async def test_update(
    data: OTUUpdateRequest,
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    static_time: StaticTime,
    test_ref: dict,
):
    user, _ = await asyncio.gather(
        fake.users.create(),
        mongo.references.insert_one(test_ref),
    )

    otu = await fake.otus.create(test_ref["_id"], user)

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
    test_otu,
    static_time,
    tmp_path,
    data_layer,
):
    test_otu["isolates"].append(
        {"default": False, "id": "bar", "source_type": "isolate", "source_name": "A"},
    )

    await mongo.otus.insert_one(test_otu)

    assert (
        await data_layer.otus.set_isolate_as_default("6116cba1", "bar", "bob")
        == snapshot
    )

    assert await mongo.otus.find_one() == snapshot
    assert await mongo.history.find_one() == snapshot


async def test_remove_sequence(
    snapshot,
    mongo,
    test_otu,
    static_time,
    tmp_path,
    data_layer,
):
    await gather(
        mongo.otus.insert_one(test_otu),
        mongo.sequences.insert_one(
            {
                "_id": "baz",
                "accession": "123abc",
                "host": "",
                "definition": "Apple virus organism",
                "segment": "RNA-B",
                "sequence": "ATGC",
                "otu_id": "6116cba1",
                "isolate_id": "cab8b360",
            },
        ),
    )

    await data_layer.otus.delete_sequence("6116cba1", "cab8b360", "baz", "bob")

    assert await mongo.otus.find_one() == snapshot
    assert await mongo.history.find_one() == snapshot
    assert await mongo.sequences.count_documents({}) == 0


@pytest.mark.parametrize("host", ["host", None])
@pytest.mark.parametrize("segment", ["seg", None])
@pytest.mark.parametrize("sequence_id", ["foobar", None])
async def test_create_sequence(
    host,
    segment,
    sequence_id,
    data_layer: DataLayer,
    mongo,
    snapshot: SnapshotAssertion,
    static_time,
    tmp_path,
):
    await mongo.otus.insert_one(
        {
            "_id": "bar",
            "name": "Bar Virus",
            "isolates": [{"id": "baz", "source_type": "isolate", "source_name": "A"}],
            "reference": {"id": "foo"},
            "verified": True,
            "version": 3,
        },
    )

    assert await data_layer.otus.create_sequence(
        "bar",
        "baz",
        "abc123",
        "A made up sequence",
        "ATGCGTGTACTG AGAGTAT\nATTTATACCACAC",
        "bob",
        host=host,
        segment=segment,
        sequence_id=sequence_id,
    ) == snapshot(name="return")

    assert await mongo.otus.find_one() == snapshot(name="otu")
    assert await mongo.sequences.find_one() == snapshot(name="sequence")
    assert await mongo.history.find_one() == snapshot(name="change")


@pytest.mark.parametrize("missing", [None, "otu", "isolate", "sequence"])
async def test_get_sequence(
    missing,
    snapshot,
    mongo,
    config,
    test_otu,
    test_isolate,
    test_ref,
    test_sequence,
    data_layer,
):
    if missing == "isolate":
        test_otu["isolates"][0]["id"] = "missing"

    if missing != "otu":
        await mongo.otus.insert_one(test_otu)

    if missing != "sequence":
        await mongo.sequences.insert_one(test_sequence)

    await mongo.references.insert_one({**test_ref, "_id": "ref"})

    if missing:
        with pytest.raises(ResourceNotFoundError):
            await data_layer.otus.get_sequence(
                test_otu["_id"],
                test_sequence["isolate_id"],
                test_sequence["_id"],
            )
    else:
        assert (
            await data_layer.otus.get_sequence(
                test_otu["_id"],
                test_sequence["isolate_id"],
                test_sequence["_id"],
            )
            == snapshot
        )


@pytest.mark.parametrize("sequence", ["ATAGAG GAGTA\nAGAGTGA", None])
async def test_update_sequence(
    sequence,
    snapshot,
    mongo,
    static_time,
    test_otu,
    test_isolate,
    test_sequence,
    tmp_path,
    data_layer,
):
    """Test that an existing sequence is updated, creating an appropriate history document
    in the process.

    """
    await gather(
        mongo.otus.insert_one(test_otu),
        mongo.sequences.insert_one(test_sequence),
    )

    update = SequenceUpdateRequest(
        accession="987xyz",
        definition="Hello world",
        host="Apple",
        segment="RNA-A",
    )

    if sequence:
        update.sequence = sequence

    return_value = await data_layer.otus.update_sequence(
        test_otu["_id"],
        test_isolate["id"],
        test_sequence["_id"],
        "bob",
        update,
    )

    assert return_value == snapshot(name="return")

    assert await asyncio.gather(
        mongo.otus.find_one(),
        mongo.history.find_one(),
        mongo.sequences.find_one(),
    ) == snapshot(name="db")


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
