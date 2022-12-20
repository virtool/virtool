import pytest
import virtool.mongo.utils


class TestApplyProjection:
    @pytest.mark.parametrize(
        "projection,expected",
        [
            (["_id", "name"], {"_id": "foo", "name": "bar"}),
            (["name"], {"_id": "foo", "name": "bar"}),
            ({"_id": True, "name": True}, {"_id": "foo", "name": "bar"}),
            ({"name": True}, {"_id": "foo", "name": "bar"}),
            ({"_id": False, "name": True}, {"name": "bar"}),
            ({"_id": False}, {"name": "bar", "age": 25}),
        ],
    )
    def test(self, projection, expected):
        """
        Test that projections are applied to documents in the same way they are in MongoDB.

        """
        document = {"_id": "foo", "name": "bar", "age": 25}

        assert virtool.mongo.utils.apply_projection(document, projection) == expected

    def test_type_error(self):
        """
        Test that a `TypeError` is raised when the projection parameter is not a `dict` or `list`.

        """
        with pytest.raises(TypeError) as excinfo:
            virtool.mongo.utils.apply_projection({}, "_id")

        assert "Invalid type for projection: <class 'str'>" in str(excinfo.value)


async def test_delete_unready(mongo):
    await mongo.analyses.insert_many(
        [{"_id": 1, "ready": True}, {"_id": 2, "ready": False}], session=None
    )

    await virtool.mongo.utils.delete_unready(mongo.analyses)

    assert await mongo.analyses.find().to_list(None) == [{"_id": 1, "ready": True}]


async def test_check_missing_ids(mongo):
    await mongo.subtraction.insert_many(
        [
            {
                "_id": "foo",
                "name": "Foo",
            },
            {
                "_id": "bar",
                "name": "Bar",
            },
        ],
        session=None,
    )

    non_existent_subtractions = await virtool.mongo.utils.check_missing_ids(
        mongo.subtraction, ["foo", "bar", "baz"]
    )

    assert non_existent_subtractions == {"baz"}
