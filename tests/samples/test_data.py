from virtool.data.layer import DataLayer


class TestRecalculateWorkflowTags:
    async def test(self, mocker, data_layer: DataLayer):
        await data_layer.samples._mongo.samples.insert_one(
            {"_id": "test", "pathoscope": False, "nuvs": False}
        )

        analysis_documents = [
            {
                "_id": "test_1",
                "workflow": "pathoscope_bowtie",
                "ready": "ip",
                "sample": {"id": "test"},
            },
            {
                "_id": "test_2",
                "workflow": "pathoscope_bowtie",
                "ready": True,
                "sample": {"id": "test"},
            },
            {
                "_id": "test_3",
                "workflow": "nuvs",
                "ready": True,
                "sample": {"id": "test"},
            },
        ]

        await data_layer.samples._mongo.analyses.insert_many(
            analysis_documents
            + [
                {
                    "_id": "test_4",
                    "sample": {"id": "foobar"},
                    "workflow": "pathoscope_bowtie",
                    "ready": True,
                }
            ],
            session=None,
        )

        m = mocker.patch(
            "virtool.samples.utils.calculate_workflow_tags",
            return_value={"pathoscope": True, "nuvs": "ip"},
        )

        await data_layer.samples.recalculate_workflow_tags("test")

        for document in analysis_documents:
            del document["sample"]

        assert m.call_args[0][0] == analysis_documents

        assert await data_layer.samples._mongo.samples.find_one() == {
            "_id": "test",
            "pathoscope": True,
            "nuvs": "ip",
            "workflows": {
                "aodp": "incompatible",
                "nuvs": "complete",
                "pathoscope": "complete",
            },
        }
