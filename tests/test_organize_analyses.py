import pytest

import virtool.organize


async def test_hmm(test_motor):
    """
    Test that NuVs results are minimized by removing annotation from the analysis documents and making them
    reference the HMM collection

    """
    await test_motor.hmm.insert_many([
        {
            "_id": 1,
            "cluster": 2
        },
        {
            "_id": 2,
            "cluster": 5
        }
    ])

    await test_motor.analyses.insert_one({
        "_id": 1,
        "algorithm": "nuvs",
        "hmm": [
            {
                "definition": "RNA polymerase",
                "families": ["foobar"],
                "hit": "cluster_2"
            },
            {
                "definition": "Capsid",
                "families": ["foobar"],
                "hit": "cluster_5"
            }
        ]
    })

    await virtool.organize.organize_analyses(test_motor)

    assert await test_motor.analyses.find().to_list(None) == [{
        "_id": 1,
        "algorithm": "nuvs",
        "hmm": [
            {
                "hit": 1
            },
            {
                "hit": 2
            }
        ]
    }]


@pytest.mark.parametrize("field", ["discovery", "_version", "name", "comments"])
async def test_unset(field, test_motor):
    """
    Test that several deprecated fields are unset as expected.

    """
    await test_motor.analyses.insert_one({
        "_id": 1,
        field: False
    })

    await virtool.organize.organize_analyses(test_motor)

    assert await test_motor.analyses.find().to_list(None) == [
        {"_id": 1, "algorithm": "pathoscope_bowtie"}
    ]


async def test_rename_timestamp(test_motor):
    """
    Test that the ``timestamp`` field is renamed to ``created_at``.

    """
    await test_motor.analyses.insert_one({
        "_id": 1,
        "timestamp": "now"
    })

    await virtool.organize.organize_analyses(test_motor)

    assert await test_motor.analyses.find().to_list(None) == [
        {"_id": 1, "algorithm": "pathoscope_bowtie", "created_at": "now"}
    ]


@pytest.mark.parametrize("sample", [{"sample": "asd1231"}, {"sample_id": "asd1231"}, {"sample": {"id": "asd1231"}}])
@pytest.mark.parametrize("document,incorrect", [
    # Incorrect index format.
    ({
         "_id": "test",
         "diagnosis": {
             "baz": {
                 "virus_id": "abc",
                 "virus_version": 2
             }
         },
         "index_id": "foobar",
         "index_version": 2,
         "job": "123abc"
    }, True),

    # No change
    ({
        "_id": "test",
        "diagnosis": [{
            "id": "baz",
            "virus": {
                "id": "abc",
                "version": 2
            }
        }],
        "index": {
            "id": "foobar",
            "version": 2
        },
        "job": {
            "id": "123abc"
        },
        "sample": {
            "id": "asd1231"
        }
    }, False)
])
async def test_upgrade(sample, document, incorrect, test_motor):
    """
    Test the the upgrade loop upgrades old v1 analysis documents into v2-compatible documents.

    """
    if incorrect:
        document.update(sample)

    await test_motor.analyses.insert_one(document)

    await virtool.organize.organize_analyses(test_motor)

    import pprint
    pprint.pprint(await test_motor.analyses.find_one())

    assert await test_motor.analyses.find_one() == {
        "_id": "test",
        "algorithm": "pathoscope_bowtie",
        "diagnosis": [{
            "id": "baz",
            "virus": {
                "id": "abc",
                "version": 2
            }
        }],
        "index": {
            "id": "foobar",
            "version": 2
        },
        "job": {
            "id": "123abc"
        },
        "sample": {
            "id": "asd1231"
        }
    }


async def test_delete_unready(test_motor):
    """
    Test that documents with the ``ready`` field set to ``False`` are deleted from the collection. These documents
    are assumed to be associated with defunct analysis jobs.

    """
    await test_motor.analyses.insert_many([
        {
            "_id": 1,
            "ready": True
        },
        {
            "_id": 2,
            "ready": False
        },
        {
            "_id": 3,
            "ready": True
        },
        {
            "_id": 4,
            "ready": False
        },
    ])

    await virtool.organize.organize_analyses(test_motor)

    assert await test_motor.analyses.find().to_list(None) == [
        {
            "_id": 1,
            "ready": True,
            "algorithm": "pathoscope_bowtie"
        },
        {
            "_id": 3,
            "ready": True,
            "algorithm": "pathoscope_bowtie"
        }
    ]
