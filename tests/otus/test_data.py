import asyncio
from asyncio import gather

import pytest

from virtool.data.errors import ResourceNotFoundError
from virtool.otus.data import OTUData
from virtool.otus.oas import UpdateSequenceRequest, CreateOTURequest, UpdateOTURequest


@pytest.mark.parametrize(
    "data",
    [
        CreateOTURequest(abbreviation="TMV", name="Tobacco mosaic virus"),
        CreateOTURequest(name="Prunus virus A"),
    ],
)
async def test_create(
    data, mongo, fake2, snapshot, static_time, test_random_alphanumeric, tmp_path
):
    otu_data = OTUData({"db": mongo})

    user = await fake2.users.create()

    assert await otu_data.create("foo", data, user.id) == snapshot(name="return")

    assert await asyncio.gather(
        mongo.otus.find_one(), mongo.history.find_one()
    ) == snapshot(name="db")


async def test_get_fasta(mongo, snapshot, test_otu, test_sequence):
    await gather(
        mongo.otus.insert_one(
            {
                **test_otu,
                "isolates": [
                    *test_otu["isolates"],
                    {"id": "baz", "source_type": "isolate", "source_name": "A"},
                ],
            }
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
            ]
        ),
    )

    otu_data = OTUData({"db": mongo})

    assert await otu_data.get_fasta(test_otu["_id"]) == snapshot


@pytest.mark.parametrize(
    "data", [UpdateOTURequest(abbreviation="TMV", name="Tobacco mosaic virus")]
)
async def test_edit(
    data,
    mongo,
    fake2,
    snapshot,
    static_time,
    test_otu,
    test_random_alphanumeric,
    tmp_path,
):
    otu_data = OTUData({"db": mongo})

    user, _ = await asyncio.gather(fake2.users.create(), mongo.otus.insert_one(test_otu))

    assert await otu_data.edit("6116cba1", data, user.id) == snapshot

    assert await asyncio.gather(
        mongo.otus.find_one(), mongo.history.find_one()
    ) == snapshot(name="db")


@pytest.mark.parametrize("default", [True, False])
@pytest.mark.parametrize("empty", [True, False], ids=["empty", "not_empty"])
@pytest.mark.parametrize("existing_default", [True, False])
@pytest.mark.parametrize("isolate_id", [None, "isolate"])
async def test_add_isolate(
    default,
    empty,
    existing_default,
    isolate_id,
    mongo,
    snapshot,
    test_otu,
    static_time,
    test_random_alphanumeric,
    tmp_path,
):
    """
    Test that adding an isolate works correctly.

    Ensures that setting the default isolate works correctly in all cases.

    """

    test_otu["isolates"][0]["default"] = existing_default

    if empty:
        test_otu["isolates"] = []

    await mongo.otus.insert_one(test_otu)

    otu_data = OTUData({"db": mongo})

    assert (
        await otu_data.add_isolate(
            "6116cba1",
            "bob",
            "isolate",
            "B",
            default=default,
            isolate_id=isolate_id,
        )
        == snapshot
    )
    assert await mongo.otus.find_one() == snapshot
    assert await mongo.history.find_one() == snapshot


async def test_edit_isolate(mongo, snapshot, test_otu, static_time, tmp_path):
    await mongo.otus.insert_one(test_otu)

    otu_data = OTUData({"db": mongo})

    assert (
        await otu_data.edit_isolate(
            "6116cba1",
            "cab8b360",
            "bob",
            source_type="strain",
            source_name="0",
        )
        == snapshot
    )

    assert await mongo.otus.find_one() == snapshot
    assert await mongo.history.find_one() == snapshot


@pytest.mark.parametrize("isolate_id", ["cab8b360", "bar"])
async def test_remove_isolate(
    isolate_id, mongo, snapshot, test_otu, test_sequence, static_time, tmp_path
):
    """
    Test removing an isolate. Make sure the default isolate is reassigned if the default isolate is removed.

    """
    test_otu["isolates"].append(
        {
            "default": False,
            "id": "bar",
            "source_type": "isolate",
            "source_name": "A",
        }
    )

    await gather(mongo.otus.insert_one(test_otu), mongo.sequences.insert_one(test_sequence))

    otu_data = OTUData({"db": mongo})

    await otu_data.remove_isolate("6116cba1", isolate_id, "bob")

    assert (
        await asyncio.gather(
            mongo.otus.find_one(),
            mongo.history.find_one(),
            mongo.sequences.find().to_list(None),
        )
        == snapshot
    )


async def test_set_default(mongo, snapshot, test_otu, static_time, tmp_path):
    test_otu["isolates"].append(
        {"default": False, "id": "bar", "source_type": "isolate", "source_name": "A"}
    )

    await mongo.otus.insert_one(test_otu)

    otu_data = OTUData({"db": mongo})

    assert await otu_data.set_isolate_as_default("6116cba1", "bar", "bob") == snapshot
    assert await mongo.otus.find_one() == snapshot
    assert await mongo.history.find_one() == snapshot


async def test_remove_sequence(snapshot, mongo, test_otu, static_time, tmp_path):
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
            }
        ),
    )

    otu_data = OTUData({"db": mongo})
    await otu_data.remove_sequence("6116cba1", "cab8b360", "baz", "bob")

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
    snapshot,
    mongo,
    static_time,
    test_random_alphanumeric,
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
        }
    )

    otu_data = OTUData(
        {
            "db": mongo,
        }
    )

    assert await otu_data.create_sequence(
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
    missing, snapshot, mongo, test_otu, test_isolate, test_sequence
):
    if missing == "isolate":
        test_otu["isolates"][0]["id"] = "missing"

    if missing != "otu":
        await mongo.otus.insert_one(test_otu)

    if missing != "sequence":
        await mongo.sequences.insert_one(test_sequence)

    otu_data = OTUData({"db": mongo})

    if missing:
        with pytest.raises(ResourceNotFoundError):
            await otu_data.get_sequence(
                test_otu["_id"], test_sequence["isolate_id"], test_sequence["_id"]
            )
    else:
        assert (
            await otu_data.get_sequence(
                test_otu["_id"], test_sequence["isolate_id"], test_sequence["_id"]
            )
            == snapshot
        )


@pytest.mark.parametrize("sequence", ["ATAGAG GAGTA\nAGAGTGA", None])
async def test_edit_sequence(
    sequence,
    snapshot,
    mongo,
    static_time,
    test_otu,
    test_isolate,
    test_sequence,
    tmp_path,
):
    """
    Test that an existing sequence is edited, creating an appropriate history document
    in the process.

    """
    await gather(mongo.otus.insert_one(test_otu), mongo.sequences.insert_one(test_sequence))

    otu_data = OTUData({"db": mongo})

    update = UpdateSequenceRequest(
        accession="987xyz",
        definition="Hello world",
        host="Apple",
        segment="RNA-A",
    )

    if sequence:
        update.sequence = sequence

    return_value = await otu_data.edit_sequence(
        test_otu["_id"], test_isolate["id"], test_sequence["_id"], "bob", update
    )

    assert return_value == snapshot(name="return")

    assert await asyncio.gather(
        mongo.otus.find_one(), mongo.history.find_one(), mongo.sequences.find_one()
    ) == snapshot(name="db")
