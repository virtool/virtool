from asyncio import gather

import pytest

from virtool.otus.data import OTUData


@pytest.mark.parametrize("abbreviation,otu_id", [("", "TMV"), (None, "otu")])
async def test_create(
    abbreviation, otu_id, snapshot, dbi, test_random_alphanumeric, static_time, tmp_path
):
    otu_data = OTUData({"db": dbi})

    assert (
        await otu_data.create(
            "foo", "Bar", "bob", abbreviation=abbreviation, otu_id=otu_id
        )
        == snapshot
    )
    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot


async def test_get_fasta(dbi, test_otu, test_sequence):
    await gather(
        dbi.otus.insert_one(
            {
                **test_otu,
                "isolates": [
                    *test_otu["isolates"],
                    {"id": "baz", "source_type": "isolate", "source_name": "A"},
                ],
            }
        ),
        dbi.sequences.insert_many(
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

    otu_data = OTUData({"db": dbi})

    assert await otu_data.get_fasta(test_otu["_id"]) == (
        "prunus_virus_f.fa",
        ">Prunus virus F|Isolate 8816-v2|KX269872|27\nTGTTTAAGAGATTAAACAACCGCTTTC\n"
        ">Prunus virus F|Isolate A|AX12345|12\nATAGAGGAGTTA",
    )


@pytest.mark.parametrize("abbreviation", [None, "", "TMV"])
async def test_edit(
    abbreviation,
    snapshot,
    dbi,
    test_otu,
    static_time,
    test_random_alphanumeric,
    tmp_path,
):
    otu_data = OTUData({"db": dbi})

    await dbi.otus.insert_one(test_otu)

    assert (
        await otu_data.edit("6116cba1", "Foo Virus", abbreviation, None, "bob")
        == snapshot
    )
    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot


@pytest.mark.parametrize("default", [True, False])
@pytest.mark.parametrize("empty", [True, False], ids=["empty", "not_empty"])
@pytest.mark.parametrize("existing_default", [True, False])
@pytest.mark.parametrize("isolate_id", [None, "isolate"])
async def test_add_isolate(
    default,
    empty,
    existing_default,
    isolate_id,
    dbi,
    snapshot,
    test_otu,
    static_time,
    test_random_alphanumeric,
    tmp_path,
):
    """
    Test that adding an isolate works correctly.

    Parametrize to make sure that setting the default isolate works correctly in all
    cases.

    """

    test_otu["isolates"][0]["default"] = existing_default

    if empty:
        test_otu["isolates"] = []

    await dbi.otus.insert_one(test_otu)

    otu_data = OTUData({"db": dbi})

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
    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot


async def test_edit_isolate(dbi, snapshot, test_otu, static_time, tmp_path):
    await dbi.otus.insert_one(test_otu)

    otu_data = OTUData({"db": dbi})

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
    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot


@pytest.mark.parametrize("isolate_id", ["cab8b360", "bar"])
async def test_remove_isolate(
    isolate_id, dbi, snapshot, test_otu, test_sequence, static_time, tmp_path
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

    await gather(dbi.otus.insert_one(test_otu), dbi.sequences.insert_one(test_sequence))

    otu_data = OTUData({"db": dbi})

    await otu_data.remove_isolate("6116cba1", isolate_id, "bob")

    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot
    assert await dbi.sequences.find().to_list(None) == snapshot


async def test_set_default(dbi, snapshot, test_otu, static_time, tmp_path):
    test_otu["isolates"].append(
        {"default": False, "id": "bar", "source_type": "isolate", "source_name": "A"}
    )

    await dbi.otus.insert_one(test_otu)

    otu_data = OTUData({"db": dbi})

    assert await otu_data.set_isolate_as_default("6116cba1", "bar", "bob") == snapshot
    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot


async def test_remove_sequence(snapshot, dbi, test_otu, static_time, tmp_path):
    await gather(
        dbi.otus.insert_one(test_otu),
        dbi.sequences.insert_one(
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

    otu_data = OTUData({"db": dbi})
    await otu_data.remove_sequence("6116cba1", "cab8b360", "baz", "bob")

    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot
    assert await dbi.sequences.count_documents({}) == 0


@pytest.mark.parametrize("host", ["host", None])
@pytest.mark.parametrize("segment", ["seg", None])
@pytest.mark.parametrize("sequence_id", ["foobar", None])
async def test_create_sequence(
    host,
    segment,
    sequence_id,
    snapshot,
    dbi,
    static_time,
    test_random_alphanumeric,
    tmp_path,
):
    await dbi.otus.insert_one(
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
            "db": dbi,
        }
    )

    assert (
        await otu_data.create_sequence(
            "bar",
            "baz",
            "abc123",
            "A made up sequence",
            "ATGCGTGTACTG AGAGTAT\nATTTATACCACAC",
            "bob",
            host=host,
            segment=segment,
            sequence_id=sequence_id,
        )
        == snapshot(name="return")
    )

    assert await dbi.otus.find_one() == snapshot(name="otu")
    assert await dbi.sequences.find_one() == snapshot(name="sequence")
    assert await dbi.history.find_one() == snapshot(name="change")


@pytest.mark.parametrize("missing", [None, "otu", "isolate", "sequence"])
async def test_get_sequence(missing, snapshot, dbi):
    isolates = []

    if missing != "isolate":
        isolates.append({"id": "bar"})

    if missing != "otu":
        await dbi.otus.insert_one({"_id": "foo", "isolates": isolates})

    if missing != "sequence":
        await dbi.sequences.insert_one(
            {
                "_id": "baz",
                "isolate_id": "bar",
                "otu_id": "foo",
                "sequence": "ATGC",
                "comment": "hello world",
            }
        )

    otu_data = OTUData({"db": dbi})

    assert await otu_data.get_sequence("foo", "bar", "baz") == snapshot


@pytest.mark.parametrize("sequence", ["ATAGAG GAGTA\nAGAGTGA", None])
async def test_edit_sequence(sequence, snapshot, dbi, static_time, tmp_path):
    """
    Test that an existing sequence is edited, creating an appropriate history document
    in the process.

    """
    await gather(
        dbi.otus.insert_one(
            {
                "_id": "foo",
                "name": "Foo Virus",
                "isolates": [
                    {"id": "bar", "source_type": "isolate", "source_name": "A"}
                ],
                "reference": {"id": "foo"},
                "verified": True,
                "version": 3,
            }
        ),
        dbi.sequences.insert_one(
            {
                "_id": "baz",
                "accession": "123abc",
                "host": "",
                "definition": "Apple virus organism",
                "segment": "RNA-B",
                "sequence": "ATGC",
                "otu_id": "foo",
                "isolate_id": "bar",
            }
        ),
    )

    otu_data = OTUData({"db": dbi})

    await otu_data.edit_sequence(
        "foo",
        "bar",
        "baz",
        "bob",
        accession="987xyz",
        definition="Hello world",
        host="Apple",
        segment="RNA-A",
        sequence=sequence,
    )

    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot
    assert await dbi.sequences.find_one() == snapshot
