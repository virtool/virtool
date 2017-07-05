import pytest

import virtool.organize


class TestHMM:

    async def test(self, test_motor):
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


class TestUnset:

    @pytest.mark.parametrize("field", ["discovery", "_version", "name", "comments"])
    async def test(self, field, test_motor):
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


class TestRenameTimeStamp:

    async def test(self, test_motor):
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


class TestSampleField:

    @pytest.mark.parametrize("field", [{"sample": "asd1231"}, {"sample_id": "asd1231"}, {"sample": {"id": "asd1231"}}])
    async def test(self, field, test_motor):
        """
        Test that old-style flat ``sample`` and ``sample_id`` fields are converted to subdocuments.

        """
        await test_motor.analyses.insert_one(dict(field, _id=1))

        await virtool.organize.organize_analyses(test_motor)

        assert await test_motor.analyses.find().to_list(None) == [
            {
                "_id": 1,
                "algorithm": "pathoscope_bowtie",
                "sample": {
                    "id": "asd1231"
                }
            }
        ]


class TestAlgorithmField:

    async def test(self, test_motor):
        """
        Test that documents with no ``algorithm`` field have that field set to a default value of ``pathoscope_bowtie``.

        """
        await test_motor.analyses.insert_one({
            "_id": 1
        })

        await virtool.organize.organize_analyses(test_motor)

        assert await test_motor.analyses.find().to_list(None) == [
            {
                "_id": 1,
                "algorithm": "pathoscope_bowtie"
            }
        ]

    async def test_no_change(self, test_motor):
        """
        Test that existing ``algorithm`` fields are not erroneously overwritten.

        """
        await test_motor.analyses.insert_one({
            "_id": 1,
            "algorithm": "nuvs"
        })

        await virtool.organize.organize_analyses(test_motor)

        assert await test_motor.analyses.find().to_list(None) == [
            {
                "_id": 1,
                "algorithm": "nuvs"
            }
        ]


class TestDeleteUnready:

    async def test(self, test_motor):
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
