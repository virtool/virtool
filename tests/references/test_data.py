import pytest
from aiohttp.test_utils import make_mocked_coro

from virtool.data.utils import get_data_from_app


class TestEdit:
    @pytest.mark.parametrize("control_exists", [True, False])
    @pytest.mark.parametrize("control_id", [None, "", "baz"])
    async def test_control(
        self, control_exists, fake2, control_id, mocker, snapshot, mongo, app
    ):
        """
        Test that the `internal_control` field is correctly set with various `internal_control` input value and the case
        where the internal control ID refers to a non-existent OTU.
        The field should only be set when the input value is truthy and the control ID exists.
        """
        user_1 = await fake2.users.create()
        user_2 = await fake2.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "data_type": "genome",
                "internal_control": {"id": "bar"},
                "user": {"id": user_1.id},
                "users": [{"id": user_2.id}],
            }
        )

        update = {"name": "Tester", "description": "This is a test reference."}

        if control_id is not None:
            update["internal_control"] = control_id

        mocker.patch(
            "virtool.references.db.get_internal_control",
            make_mocked_coro({"id": "baz"} if control_exists else None),
        )

        document = await get_data_from_app(app).references.update_reference(
            "foo", update
        )

        assert document == snapshot
        assert await mongo.references.find_one() == snapshot

    async def test_reference_name(self, snapshot, mongo, fake2, app):
        """
        Test that analyses that are linked to the edited reference have their `reference.name` fields changed when
        the `name` field of the reference changes.
        """
        user_1 = await fake2.users.create()
        user_2 = await fake2.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "name": "Foo",
                "data_type": "genome",
                "internal_control": {"id": "bar"},
                "user": {"id": user_1.id},
                "users": [{"id": user_2.id}],
            }
        )

        await mongo.analyses.insert_many(
            [
                {"_id": "baz", "reference": {"id": "foo", "name": "Foo"}},
                {"_id": "boo", "reference": {"id": "foo", "name": "Foo"}},
            ]
        )

        document = await get_data_from_app(app).references.update_reference(
            "foo", {"name": "Bar"}
        )

        assert document == snapshot
        assert await mongo.references.find_one() == snapshot
        assert await mongo.analyses.find().to_list(None) == snapshot
