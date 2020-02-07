import pymongo.results
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.db.core
import virtool.utils


@pytest.fixture
def create_test_collection(mocker, test_motor):
    def func(name="samples", projection=None, silent=False) -> virtool.db.core.Collection:
        processor = make_mocked_coro(return_value={"id": "foo", "mock": True})

        return virtool.db.core.Collection(
            name,
            test_motor[name],
            make_mocked_coro(),
            processor,
            projection,
            silent
        )

    return func


class TestCollection:

    @pytest.mark.parametrize("projection", [None, ["name"]], ids=["projection", "no projection"])
    def test_apply_projection(self, projection, create_test_collection):
        """
        Test that :meth:`Collection.apply_projection` returns a projected version of the passed document when
        :attr:`Collection.projection` is defined and returns the document untouched when no projection is defined.

        """
        collection = create_test_collection(projection=projection)

        document = {
            "_id": "foo",
            "name": "Foo",
            "tags": [
                "bar",
                "baz"
            ]
        }

        projected = collection.apply_projection(document)

        if projection:
            assert projected == {
                "_id": "foo",
                "name": "Foo"
            }
            return

        assert projected == document

    @pytest.mark.parametrize("condition", [None, "param_silent", "attr_silent"])
    @pytest.mark.parametrize("has_processor", [True, False])
    async def test_dispatch_conditionally(self, condition, has_processor, mocker, create_test_collection):
        """
        Test that `dispatch_conditionally` dispatches a message when not suppressed by the `silent` parameter or
        :attr:`Collection.silent`.

        """
        collection = create_test_collection(silent=(condition == "attr_silent"))

        collection.apply_processor = make_mocked_coro(return_value={
            "id": "foo",
            "name": "Foo",
            "tags": [
                "bar",
                "baz"
            ]
        })

        document = {
            "_id": "foo",
            "name": "Foo",
            "tags": [
                "bar",
                "baz"
            ]
        }

        await collection.dispatch_conditionally(document, "update", silent=(condition == "param_silent"))

        if condition is None:
            collection.dispatch.assert_called_with("samples", "update", {
                "id": "foo",
                "name": "Foo",
                "tags": [
                    "bar",
                    "baz"
                ]
            })

            collection.apply_processor.assert_called_with(document)
            return

        assert collection.dispatch.called is False

    @pytest.mark.parametrize("attr_silent", [True, False])
    @pytest.mark.parametrize("param_silent", [True, False])
    async def test_delete_many(self, attr_silent, param_silent, test_motor, create_test_collection):
        collection = create_test_collection(silent=attr_silent)

        await test_motor.samples.insert_many([
            {"_id": "foo", "tag": 1},
            {"_id": "bar", "tag": 2},
            {"_id": "baz", "tag": 1}
        ])

        delete_result = await collection.delete_many({"tag": 1}, silent=param_silent)

        assert isinstance(delete_result, pymongo.results.DeleteResult)
        assert delete_result.deleted_count == 2

        if not (attr_silent or param_silent):
            collection.dispatch.assert_called_with("samples", "delete", ["foo", "baz"])

        assert await test_motor.samples.find().to_list(None) == [
            {"_id": "bar", "tag": 2}
        ]

    @pytest.mark.parametrize("attr_silent", [True, False])
    @pytest.mark.parametrize("param_silent", [True, False])
    async def test_delete_one(self, attr_silent, param_silent, test_motor, create_test_collection):
        collection = create_test_collection(silent=attr_silent)

        await test_motor.samples.insert_many([
            {"_id": "foo", "tag": 1},
            {"_id": "bar", "tag": 2},
            {"_id": "baz", "tag": 1}
        ])

        delete_result = await collection.delete_one({"tag": 1}, silent=param_silent)

        assert isinstance(delete_result, pymongo.results.DeleteResult)
        assert delete_result.deleted_count == 1

        if not (attr_silent or param_silent):
            collection.dispatch.assert_called_with("samples", "delete", ["foo"])

        assert await test_motor.samples.find().to_list(None) == [
            {"_id": "bar", "tag": 2},
            {"_id": "baz", "tag": 1}
        ]




