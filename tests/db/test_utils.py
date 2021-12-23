import pytest
import virtool.db
import virtool.db.utils
from virtool.db.utils import buffered_bulk_writer


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

        assert virtool.db.utils.apply_projection(document, projection) == expected

    def test_type_error(self):
        """
        Test that a `TypeError` is raised when the projection parameter is not a `dict` or `list`.

        """
        with pytest.raises(TypeError) as excinfo:
            virtool.db.utils.apply_projection({}, "_id")

        assert "Invalid type for projection: <class 'str'>" in str(excinfo.value)


async def test_delete_unready(dbi):
    await dbi.analyses.insert_many(
        [{"_id": 1, "ready": True}, {"_id": 2, "ready": False}]
    )

    await virtool.db.utils.delete_unready(dbi.analyses)

    assert await dbi.analyses.find().to_list(None) == [{"_id": 1, "ready": True}]


async def test_check_missing_ids(dbi):
    await dbi.subtraction.insert_many(
        [
            {
                "_id": "foo",
                "name": "Foo",
            },
            {
                "_id": "bar",
                "name": "Bar",
            },
        ]
    )

    non_existent_subtractions = await virtool.db.utils.check_missing_ids(
        dbi.subtraction, ["foo", "bar", "baz"]
    )

    assert non_existent_subtractions == {"baz"}


@pytest.mark.parametrize("batch_size", (60, 100))
async def test_buffered_bulk_writer(batch_size, data_regression, snapshot, mocker):
    collection = mocker.Mock()
    collection.bulk_write = mocker.AsyncMock()

    async with buffered_bulk_writer(collection, batch_size=batch_size) as writer:
        for number in range(0, 372):
            await writer.add(number)

    assert collection.bulk_write.call_args_list == snapshot
