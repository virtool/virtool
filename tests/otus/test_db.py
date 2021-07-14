import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.otus.db


@pytest.mark.parametrize("name,abbreviation,return_value", [
    ("Foobar Virus", "FBR", False),
    ("Prunus virus F", "FBR", "Name already exists"),
    ("Foobar Virus", "PVF", "Abbreviation already exists"),
    ("Prunus virus F", "PVF", "Name and abbreviation already exist"),
], ids=["name_exists", "abbreviation_exists", "both_exist", "neither exist"])
async def test_check_name_and_abbreviation(name, abbreviation, return_value, dbi, test_otu):
    """
    Test that the function works properly for all possible inputs.

    """
    await dbi.otus.insert_one(test_otu)

    result = await virtool.otus.db.check_name_and_abbreviation(dbi, "hxn167", name, abbreviation)

    assert result == return_value


@pytest.mark.parametrize("abbreviation,otu_id", [
    ("", "TMV"),
    (None, "otu")
])
async def test_create_otu(
        abbreviation,
        otu_id,
        snapshot,
        dbi,
        test_random_alphanumeric,
        static_time,
        tmp_path
):
    app = {
        "db": dbi,
        "settings": {
            "data_path": tmp_path
        }
    }

    if otu_id:
        await virtool.otus.db.create_otu(
            app,
            "foo",
            "Bar",
            abbreviation,
            "bob",
            otu_id
        )
    else:
        await virtool.otus.db.create_otu(
            app,
            "foo",
            "Bar",
            abbreviation,
            "bob"
        )

    snapshot.assert_match(await dbi.otus.find_one(), "otu")
    snapshot.assert_match(await dbi.history.find_one(), "history")


@pytest.mark.parametrize("abbreviation", [None, "", "TMV"])
async def test_edit(abbreviation, snapshot, dbi, test_otu, static_time, test_random_alphanumeric, tmp_path):
    app = {
        "db": dbi,
        "settings": {
            "data_path": tmp_path
        }
    }

    await dbi.otus.insert_one(test_otu)

    await virtool.otus.db.edit(
        app,
        "6116cba1",
        "Foo Virus",
        abbreviation,
        None,
        "bob"
    )

    snapshot.assert_match(await dbi.otus.find_one(), "otu")
    snapshot.assert_match(await dbi.history.find_one(), "history")


@pytest.mark.parametrize("in_db", [True, False])
@pytest.mark.parametrize("pass_document", [True, False])
async def test_join(in_db, pass_document, mocker, dbi, test_otu, test_sequence, test_merged_otu):
    """
    Test that a otu is properly joined when only a ``otu_id`` is provided.

    """
    await dbi.otus.insert_one(test_otu)
    await dbi.sequences.insert_one(test_sequence)

    m_find_one = mocker.patch.object(
        dbi.otus,
        "find_one",
        make_mocked_coro(test_otu if in_db else None)
    )

    kwargs = dict(document=test_otu) if pass_document else dict()

    joined = await virtool.otus.db.join(dbi, "6116cba1", **kwargs)

    assert m_find_one.called != pass_document

    if in_db or (not in_db and pass_document):
        assert joined == test_merged_otu
    else:
        assert joined is None


async def test_generate_otu_fasta(dbi, test_otu, test_sequence):
    await dbi.otus.insert_one(
        dict(test_otu, isolates=[
            *test_otu["isolates"],
            {
                "id": "baz",
                "source_type": "isolate",
                "source_name": "A"
            }
        ])
    )

    await dbi.sequences.insert_many([
        test_sequence,
        dict(test_sequence, _id="AX12345", sequence="ATAGAGGAGTTA", isolate_id="baz")
    ])

    expected = (
        "prunus_virus_f.fa",
        ">Prunus virus F|Isolate 8816-v2|KX269872|27\nTGTTTAAGAGATTAAACAACCGCTTTC\n"
        ">Prunus virus F|Isolate A|AX12345|12\nATAGAGGAGTTA"
    )

    assert await virtool.otus.db.generate_otu_fasta(dbi, test_otu["_id"]) == expected
