import pytest
from virtool.otus.sequences import (
    check_segment_or_target,
    create,
    edit,
    get,
    increment_otu_version,
    remove,
)


@pytest.mark.parametrize("data_type", ["genome", "barcode"])
@pytest.mark.parametrize("defined", [True, False])
@pytest.mark.parametrize("missing", [True, False])
@pytest.mark.parametrize("used", [True, False])
@pytest.mark.parametrize("sequence_id", ["boo", "bad", None])
async def test_check_segment_or_target(
    data_type, defined, missing, used, sequence_id, dbi
):
    """
    Test that issues with `segment` or `target` fields in sequence editing requests are detected.

    """
    await dbi.otus.insert_one({"_id": "foo", "schema": [{"name": "RNA1"}]})

    await dbi.references.insert_one(
        {"_id": "bar", "data_type": data_type, "targets": [{"name": "CPN60"}]}
    )

    await dbi.sequences.insert_one(
        {
            "_id": "boo",
            "otu_id": "foo",
            "isolate_id": "baz",
            "target": "CPN60" if used else "ITS2",
        }
    )

    data = dict()

    if data_type == "barcode":
        data["target"] = "CPN60" if defined else "ITS2"
    else:
        data["segment"] = "RNA1" if defined else "RNA2"

    if missing:
        data = dict()

    message = await check_segment_or_target(dbi, "foo", "baz", sequence_id, "bar", data)

    # The only case where an error message should be returned for a genome-type reference.
    if data_type == "genome" and not missing and not defined:
        assert message == "Segment RNA2 is not defined for the parent OTU"
        return

    if data_type == "barcode":
        if sequence_id is None and missing:
            assert message == "The 'target' field is required for barcode references"
            return

        if not missing and not defined:
            assert message == "Target ITS2 is not defined for the parent reference"
            return

        if sequence_id != "boo" and not missing and used and data_type == "barcode":
            assert message == "Target CPN60 is already used in isolate baz"
            return

    assert message is None


@pytest.mark.parametrize("host", [True, False])
@pytest.mark.parametrize("segment", [True, False])
@pytest.mark.parametrize("sequence_id", ["foobar", None])
async def test_create(
    host,
    segment,
    sequence_id,
    snapshot,
    dbi,
    static_time,
    test_random_alphanumeric,
    tmp_path,
):
    app = {
        "db": dbi,
    }

    data = {
        "accession": "abc123",
        "host": "Plant",
        "sequence": "ATGCGTGTACTG AGAGTAT\nATTTATACCACAC",
        "definition": "A made up sequence",
    }

    if segment:
        data["segment"] = "seg"

    if host:
        data["host"] = "host"

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

    await create(app, "foo", "bar", "baz", data, "bob", sequence_id)

    assert await dbi.otus.find_one() == snapshot
    assert await dbi.sequences.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot


@pytest.mark.parametrize("sequence", [True, False])
async def test_edit(sequence, snapshot, dbi, static_time, tmp_path):
    """
    Test that an existing sequence is edited, creating an appropriate history document in the process.

    """
    app = {"db": dbi}

    await dbi.otus.insert_one(
        {
            "_id": "foo",
            "name": "Foo Virus",
            "isolates": [{"id": "bar", "source_type": "isolate", "source_name": "A"}],
            "reference": {"id": "foo"},
            "verified": True,
            "version": 3,
        }
    )

    await dbi.sequences.insert_one(
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
    )

    data = {
        "accession": "987xyz",
        "host": "Apple",
        "definition": "Hello world",
        "segment": "RNA-A",
    }

    if sequence:
        data["sequence"] = "ATAGAG GAGTA\nAGAGTGA"

    await edit(app, "foo", "bar", "baz", data, "bob")

    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot
    assert await dbi.sequences.find_one() == snapshot


@pytest.mark.parametrize("missing", [None, "otu", "isolate", "sequence"])
async def test_get(missing, snapshot, dbi):

    isolates = list()

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

    return_value = await get(dbi, "foo", "bar", "baz")

    assert return_value == snapshot


async def test_increment_otu_version(dbi, snapshot):
    await dbi.otus.insert_one({"_id": "foo", "version": 3, "verified": True})

    await increment_otu_version(dbi, "foo")

    assert await dbi.otus.find_one() == snapshot


async def test_remove(snapshot, dbi, test_otu, static_time, tmp_path):
    app = {"db": dbi}

    await dbi.otus.insert_one(test_otu)

    await dbi.sequences.insert_one(
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
    )

    await remove(app, "6116cba1", "cab8b360", "baz", "bob")

    assert await dbi.otus.find_one() == snapshot
    assert await dbi.history.find_one() == snapshot
    assert await dbi.sequences.count_documents({}) == 0
