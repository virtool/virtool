import os
import pytest

import virtool.samples.db
import virtool.samples.utils
from virtool.labels.models import Label


class TestCalculateWorkflowTags:

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
        Test that the function returns the correct update dict for every combination of pathoscope and nuvs
        ready states.

        """
        index = 0

        path_ready_1, path_ready_2 = path_ready
        nuvs_ready_1, nuvs_ready_2 = nuvs_ready

        documents = [
            {
                "_id": index,
                "ready": path_ready_1,
                "workflow": "pathoscope_{}".format(alg1)
            },
            {
                "_id": index,
                "ready": path_ready_2,
                "workflow": "pathoscope_{}".format(alg2)
            },
            {
                "_id": index,
                "ready": nuvs_ready_1,
                "workflow": "nuvs"
            },
            {
                "_id": index,
                "ready": nuvs_ready_2,
                "workflow": "nuvs"
            }
        ]

        tags = virtool.samples.utils.calculate_workflow_tags(documents)

        assert tags == {
            "pathoscope": path_tag,
            "nuvs": nuvs_tag
        }


class TestRecalculateWorkflowTags:

    async def test(self, mocker, dbi):
        await dbi.samples.insert_one({
            "_id": "test",
            "pathoscope": False,
            "nuvs": False
        })

        analysis_documents = [
            {
                "_id": "test_1",
                "workflow": "pathoscope_bowtie",
                "ready": "ip",
                "sample": {
                    "id": "test"
                }
            },
            {
                "_id": "test_2",
                "workflow": "pathoscope_bowtie",
                "ready": True,
                "sample": {
                    "id": "test"
                }
            },
            {
                "_id": "test_3",
                "workflow": "nuvs",
                "ready": True,
                "sample": {
                    "id": "test"
                }
            }
        ]

        await dbi.analyses.insert_many(analysis_documents + [
            {
                "_id": "test_4",
                "sample": {
                    "id": "foobar"
                },
                "workflow": "pathoscope_bowtie",
                "ready": True
            }
        ])

        m = mocker.patch("virtool.samples.utils.calculate_workflow_tags", return_value={
            "pathoscope": True,
            "nuvs": "ip"
        })

        await virtool.samples.db.recalculate_workflow_tags(dbi, "test")

        for document in analysis_documents:
            del document["sample"]

        assert m.call_args[0][0] == analysis_documents

        assert await dbi.samples.find_one() == {
            "_id": "test",
            "pathoscope": True,
            "nuvs": "ip"
        }


class TestGetSampleOwner:

    async def test(self, dbi):
        """
        Test that the correct owner id is returned given a sample id.

        """
        await dbi.samples.insert_many([
            {
                "_id": "test",
                "user": {
                    "id": "foobar"
                }
            },
            {
                "_id": "baz",
                "user": {
                    "id": "fred"
                }
            },
        ])

        assert await virtool.samples.db.get_sample_owner(dbi, "test") == "foobar"

    async def test_none(self, dbi):
        """
        Test that ``None`` is returned if the sample id does not exist.

        """
        assert await virtool.samples.db.get_sample_owner(dbi, "foobar") is None


class TestRemoveSamples:

    @pytest.mark.parametrize("id_list,ls,samples,analyses", [
        (
            ["test_1"],
            ["test_2", "test_3"],
            [{"_id": "test_2"}, {"_id": "test_3"}],
            [
                {"_id": "a_3", "sample": {"id": "test_2"}},
                {"_id": "a_4", "sample": {"id": "test_2"}},
                {"_id": "a_5", "sample": {"id": "test_2"}},
                {"_id": "a_6", "sample": {"id": "test_3"}},
                {"_id": "a_7", "sample": {"id": "test_3"}},
                {"_id": "a_8", "sample": {"id": "test_3"}},
                {"_id": "a_9", "sample": {"id": "test_3"}}
            ]
        ),
        (
            ["test_1", "test_2"],
            ["test_3"],
            [{"_id": "test_3"}],
            [
                {"_id": "a_6", "sample": {"id": "test_3"}},
                {"_id": "a_7", "sample": {"id": "test_3"}},
                {"_id": "a_8", "sample": {"id": "test_3"}},
                {"_id": "a_9", "sample": {"id": "test_3"}}
            ]
        )
    ])
    async def test(self, id_list, ls, samples, analyses, tmpdir, dbi):
        """
        Test that the function can remove one or more samples, their analysis documents, and files.

        """
        samples_dir = tmpdir.mkdir("samples")

        sample_1_file = samples_dir.mkdir("test_1").join("test.txt")
        sample_2_file = samples_dir.mkdir("test_2").join("test.txt")
        sample_3_file = samples_dir.mkdir("test_3").join("test.txt")

        for handle in [sample_1_file, sample_2_file, sample_3_file]:
            handle.write("hello world")

        await dbi.samples.insert_many([
            {"_id": "test_1"},
            {"_id": "test_2"},
            {"_id": "test_3"}
        ])

        await dbi.analyses.insert_many([
            {"_id": "a_1", "sample": {"id": "test_1"}},
            {"_id": "a_2", "sample": {"id": "test_1"}},
            {"_id": "a_3", "sample": {"id": "test_2"}},
            {"_id": "a_4", "sample": {"id": "test_2"}},
            {"_id": "a_5", "sample": {"id": "test_2"}},
            {"_id": "a_6", "sample": {"id": "test_3"}},
            {"_id": "a_7", "sample": {"id": "test_3"}},
            {"_id": "a_8", "sample": {"id": "test_3"}},
            {"_id": "a_9", "sample": {"id": "test_3"}}
        ])

        settings = {
            "data_path": str(tmpdir)
        }

        await virtool.samples.db.remove_samples(dbi, settings, id_list)

        assert set(ls) == set(os.listdir(str(samples_dir)))

        assert await dbi.samples.find().to_list(None) == samples
        assert await dbi.analyses.find().to_list(None) == analyses

    async def test_not_list(self, dbi):
        """
        Test that a custom ``TypeError`` is raised if a non-list variable is passed as ``id_list``.

        """
        settings = {
            "data_path"
        }

        with pytest.raises(TypeError) as excinfo:
            await virtool.samples.db.remove_samples(dbi, settings, "foobar")

        assert "id_list must be a list" in str(excinfo.value)

    async def test_file_not_found(self, tmpdir, dbi):
        """
        Test that the function does not fail when a sample folder is missing.

        """
        samples_dir = tmpdir.mkdir("samples")

        sample_1_file = samples_dir.mkdir("test_1").join("test.txt")

        sample_1_file.write("hello world")

        await dbi.samples.insert_many([
            {"_id": "test_1"},
            {"_id": "test_2"}
        ])

        settings = {
            "data_path": str(tmpdir)
        }

        await virtool.samples.db.remove_samples(dbi, settings, ["test_1", "test_2"])

        assert os.listdir(str(samples_dir)) == []

        assert not await dbi.samples.count_documents({})


async def test_attach_labels(spawn_client, pg_session):
    client = await spawn_client(authorize=True)

    label_1 = Label(id=1, name="Bug", color="#a83432", description="This is a bug")
    label_2 = Label(id=2, name="Question", color="#03fc20", description="This is a question")

    async with pg_session as session:
        session.add_all([label_1, label_2])
        await session.commit()

    document = {
        "id": "foo",
        "name": "Foo",
        "labels": [1, 2]
    }

    result = await virtool.samples.db.attach_labels(client.app["postgres"], document)

    assert result == {
        "id": "foo",
        "name": "Foo",
        "labels": [
            {"id": 1, "name": "Bug", "color": "#a83432", "description": "This is a bug"},
            {"id": 2, "name": "Question", "color": "#03fc20", "description": "This is a question"}
        ]
    }
