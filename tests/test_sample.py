import os
import pytest

import virtool.sample


class TestCalculateAlgorithmTags:

    @pytest.mark.parametrize("path_ready,path_tag", [
        ([False, False], "ip"),
        ([True, False], True),
        ([False, True], True),
        ([True, True], True)
    ])
    @pytest.mark.parametrize("alg1,alg2", [
        ("bowtie", "bowtie"),
        ("bowtie", "barracuda"),
        ("barracuda", "bowtie"),
        ("barracuda", "barracuda")
    ])
    @pytest.mark.parametrize("nuvs_ready,nuvs_tag", [
        ([False, False], "ip"),
        ([True, False], True),
        ([False, True], True),
        ([True, True], True)
    ])
    def test(self, path_ready, alg1, alg2, path_tag, nuvs_ready, nuvs_tag):
        """
        Test the calculate_algorithm_tags returns the correct update dict for every combination of pathoscope and nuvs
        ready states.

        """
        index = 0

        path_ready_1, path_ready_2 = path_ready
        nuvs_ready_1, nuvs_ready_2 = nuvs_ready

        documents = [
            {
                "_id": index,
                "ready": path_ready_1,
                "algorithm": "pathoscope_{}".format(alg1)
            },
            {
                "_id": index,
                "ready": path_ready_2,
                "algorithm": "pathoscope_{}".format(alg2)
            },
            {
                "_id": index,
                "ready": nuvs_ready_1,
                "algorithm": "nuvs"
            },
            {
                "_id": index,
                "ready": nuvs_ready_2,
                "algorithm": "nuvs"
            }
        ]

        tags = virtool.sample.calculate_algorithm_tags(documents)

        assert tags == {
            "pathoscope": path_tag,
            "nuvs": nuvs_tag
        }


class TestRecalculateAlgorithmTags:

    async def test(self, mocker, test_motor):
        await test_motor.samples.insert_one({
            "_id": "test",
            "pathoscope": False,
            "nuvs": False
        })

        analysis_documents = [
            {
                "_id": "test_1",
                "sample_id": "test",
                "algorithm": "pathoscope_bowtie",
                "ready": "ip"
            },
            {
                "_id": "test_2",
                "sample_id": "test",
                "algorithm": "pathoscope_bowtie",
                "ready": True
            },
            {
                "_id": "test_3",
                "sample_id": "test",
                "algorithm": "nuvs",
                "ready": True
            }
        ]

        await test_motor.analyses.insert_many(analysis_documents + [
            {
                "_id": "test_4",
                "sample_id": "foobar",
                "algorithm": "pathoscope_bowtie",
                "ready": True
            }
        ])

        m = mocker.patch("virtool.sample.calculate_algorithm_tags", return_value={
            "pathoscope": True,
            "nuvs": "ip"
        })

        await virtool.sample.recalculate_algorithm_tags(test_motor, "test")

        for document in analysis_documents:
            del document["sample_id"]

        assert m.call_args[0][0] == analysis_documents

        assert await test_motor.samples.find_one() == {
            "_id": "test",
            "pathoscope": True,
            "nuvs": "ip"
        }


class TestGetSampleOwner:

    async def test(self, test_motor):
        """
        Test that the correct owner id is returned given a sample id.

        """
        await test_motor.samples.insert_many([
            {
                "_id": "test",
                "user_id": "foobar"
            },
            {
                "_id": "baz",
                "user_id": "fred"
            },
        ])

        assert await virtool.sample.get_sample_owner(test_motor, "test") == "foobar"

    async def test_none(self, test_motor):
        """
        Test that ``None`` is returned if the sample id does not exist.

        """
        assert await virtool.sample.get_sample_owner(test_motor, "foobar") is None


class TestRemoveSamples:

    @pytest.mark.parametrize("id_list,ls,samples,analyses", [
        (
            ["test_1"],
            ["sample_test_2", "sample_test_3"],
            [{"_id": "test_2"}, {"_id": "test_3"}],
            [
                {"_id": "a_3", "sample_id": "test_2"},
                {"_id": "a_4", "sample_id": "test_2"},
                {"_id": "a_5", "sample_id": "test_2"},
                {"_id": "a_6", "sample_id": "test_3"},
                {"_id": "a_7", "sample_id": "test_3"},
                {"_id": "a_8", "sample_id": "test_3"},
                {"_id": "a_9", "sample_id": "test_3"}
            ]
        ),
        (
            ["test_1", "test_2"],
            ["sample_test_3"],
            [{"_id": "test_3"}],
            [
                {"_id": "a_6", "sample_id": "test_3"},
                {"_id": "a_7", "sample_id": "test_3"},
                {"_id": "a_8", "sample_id": "test_3"},
                {"_id": "a_9", "sample_id": "test_3"}
            ]
        )
    ])
    async def test(self, id_list, ls, samples, analyses, tmpdir, test_motor):
        """
        Test that the function can remove one or more samples, their analysis documents, and files.

        """
        samples_dir = tmpdir.mkdir("samples")

        sample_1_file = samples_dir.mkdir("sample_test_1").join("test.txt")
        sample_2_file = samples_dir.mkdir("sample_test_2").join("test.txt")
        sample_3_file = samples_dir.mkdir("sample_test_3").join("test.txt")

        for handle in [sample_1_file, sample_2_file, sample_3_file]:
            handle.write("hello world")

        await test_motor.samples.insert_many([
            {"_id": "test_1"},
            {"_id": "test_2"},
            {"_id": "test_3"}
        ])

        await test_motor.analyses.insert_many([
            {"_id": "a_1", "sample_id": "test_1"},
            {"_id": "a_2", "sample_id": "test_1"},
            {"_id": "a_3", "sample_id": "test_2"},
            {"_id": "a_4", "sample_id": "test_2"},
            {"_id": "a_5", "sample_id": "test_2"},
            {"_id": "a_6", "sample_id": "test_3"},
            {"_id": "a_7", "sample_id": "test_3"},
            {"_id": "a_8", "sample_id": "test_3"},
            {"_id": "a_9", "sample_id": "test_3"}
        ])

        settings = {
            "data_path": str(tmpdir)
        }

        await virtool.sample.remove_samples(test_motor, settings, id_list)

        assert set(ls) == set(os.listdir(str(samples_dir)))

        assert await test_motor.samples.find().to_list(None) == samples
        assert await test_motor.analyses.find().to_list(None) == analyses

    async def test_not_list(self, test_motor):
        """
        Test that a custom ``TypeError`` is raised if a non-list variable is passed as ``id_list``.

        """
        settings = {
            "data_path"
        }

        with pytest.raises(TypeError) as err:
            await virtool.sample.remove_samples(test_motor, settings, "foobar")

        assert "id_list must be a list" in str(err)

    async def test_file_not_found(self, tmpdir, test_motor):
        """
        Test that the function does not fail when a sample folder is missing.

        """
        samples_dir = tmpdir.mkdir("samples")

        sample_1_file = samples_dir.mkdir("sample_test_1").join("test.txt")

        sample_1_file.write("hello world")

        await test_motor.samples.insert_many([
            {"_id": "test_1"},
            {"_id": "test_2"}
        ])

        settings = {
            "data_path": str(tmpdir)
        }

        await virtool.sample.remove_samples(test_motor, settings, ["test_1", "test_2"])

        assert os.listdir(str(samples_dir)) == []

        assert not await test_motor.samples.count()
