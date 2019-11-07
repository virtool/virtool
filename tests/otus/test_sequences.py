from aiohttp.test_utils import make_mocked_coro
import pytest
import virtool.otus.sequences


@pytest.mark.parametrize("host", [True, False])
@pytest.mark.parametrize("segment", [True, False])
async def test_create(host, segment, mocker, snapshot, dbi, static_time, test_random_alphanumeric):
    """

    """
    data = {
        "accession": "abc123",
        "host": "Plant",
        "sequence": "ATGCGTGTACTG AGAGTAT\nATTTATACCACAC",
        "definition": "A made up sequence"
    }

    if segment:
        data["segment"] = "seg"

    if host:
        data["host"] = "host"

    await dbi.otus.insert_one({
        "_id": "bar",
        "name": "Bar Virus",
        "isolates": [
            {
                "id": "baz",
                "source_type": "isolate",
                "source_name": "A"
            }
        ],
        "reference": {
            "id": "foo"
        },
        "verified": True,
        "version": 3
    })

    await virtool.otus.sequences.create(
        dbi,
        "foo",
        "bar",
        "baz",
        data,
        "bob"
    )

    otu = await dbi.otus.find_one()
    snapshot.assert_match(otu)

    sequence = await dbi.sequences.find_one()
    snapshot.assert_match(sequence)

    history = await dbi.history.find_one()
    snapshot.assert_match(history)


@pytest.mark.parametrize("sequence", [True, False])
async def test_edit(sequence, snapshot, dbi, static_time):
    """

    :param sequence:
    :param dbi:
    :return:
    """
    await dbi.otus.insert_one({
        "_id": "foo",
        "name": "Foo Virus",
        "isolates": [
            {
                "id": "bar",
                "source_type": "isolate",
                "source_name": "A"
            }
        ],
        "reference": {
            "id": "foo"
        },
        "verified": True,
        "version": 3
    })

    await dbi.sequences.insert_one({
        "_id": "baz",
        "accession": "123abc",
        "host": "",
        "definition": "Apple virus organism",
        "segment": "RNA-B",
        "sequence": "ATGC",
        "otu_id": "foo",
        "isolate_id": "bar"
    })

    data = {
        "accession": "987xyz",
        "host": "Apple",
        "definition": "Hello world",
        "segment": "RNA-A",
    }

    if sequence:
        data["sequence"] = "ATAGAG GAGTA\nAGAGTGA"

    await virtool.otus.sequences.edit(
        dbi,
        "foo",
        "bar",
        "baz",
        data,
        "bob"
    )

    snapshot.assert_match(await dbi.otus.find_one())
    snapshot.assert_match(await dbi.history.find_one())
    snapshot.assert_match(await dbi.sequences.find_one())


@pytest.mark.parametrize("missing", [None, "otu", "isolate", "sequence"])
async def test_get(missing, snapshot, dbi):

    isolates = list()

    if missing != "isolate":
        isolates.append({
            "id": "bar"
        })

    if missing != "otu":
        await dbi.otus.insert_one({
            "_id": "foo",
            "isolates": isolates
        })

    if missing != "sequence":
        await dbi.sequences.insert_one({
            "_id": "baz",
            "isolate_id": "bar",
            "otu_id": "foo",
            "sequence": "ATGC",
            "comment": "hello world"
        })

    document = await virtool.otus.sequences.get(
        dbi,
        "foo",
        "bar",
        "baz"
    )

    snapshot.assert_match(document)


async def test_increment_otu_version(dbi, snapshot):
    await dbi.otus.insert_one({
        "_id": "foo",
        "version": 3,
        "verified": True
    })

    await virtool.otus.sequences.increment_otu_version(dbi, "foo")

    otu = await dbi.otus.find_one()
    snapshot.assert_match(otu)


async def test_remove(snapshot, dbi, test_otu, static_time):
    await dbi.otus.insert_one(test_otu)

    await dbi.sequences.insert_one({
        "_id": "baz",
        "accession": "123abc",
        "host": "",
        "definition": "Apple virus organism",
        "segment": "RNA-B",
        "sequence": "ATGC",
        "otu_id": "6116cba1",
        "isolate_id": "cab8b360"
    })

    await virtool.otus.sequences.remove(
        dbi,
        "6116cba1",
        "cab8b360",
        "baz",
        "bob"
    )

    snapshot.assert_match(await dbi.otus.find_one())
    snapshot.assert_match(await dbi.history.find_one())

    assert await dbi.sequences.count() == 0
