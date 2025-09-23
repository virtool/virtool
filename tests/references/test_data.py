import pytest
from aiohttp.test_utils import make_mocked_coro

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.ml import data
from virtool.mongo.core import Mongo
from virtool.references.oas import (
    CreateReferenceGroupRequest,
    CreateReferenceRequest,
    CreateReferenceUserRequest,
    ReferenceRightsRequest,
    UpdateReferenceRequest,
)


class TestUpdate:
    @pytest.mark.parametrize("control_exists", [True, False])
    @pytest.mark.parametrize("control_id", [None, "", "baz"])
    async def test_control(
        self,
        control_exists: bool,
        control_id: str | None,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that the `internal_control` field is correctly set with various `internal_control` input value and the case
        where the internal control ID refers to a non-existent OTU.
        The field should only be set when the input value is truthy and the control ID exists.
        """
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user_1.id},
                "users": [
                    {
                        "id": user_2.id,
                        "build": True,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            },
        )

        update = UpdateReferenceRequest(
            name="Tester",
            description="This is a test reference.",
        )

        if control_id is not None:
            update.internal_control = control_id

        mocker.patch(
            "virtool.references.db.get_internal_control",
            make_mocked_coro({"id": "baz"} if control_exists else None),
        )

        assert await data_layer.references.update("foo", update) == snapshot
        assert await mongo.references.find_one() == snapshot


class TestCreateUser:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that a user can be added to a reference."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"), user_1.id
        )

        user = await data_layer.references.create_user(
            reference.id,
            CreateReferenceUserRequest(
                build=True,
                modify_otu=True,
                user_id=user_2.id,
            ),
        )

        assert user.id == user_2.id
        assert user == snapshot(name="user_obj")
        assert await data_layer.references.get(reference.id) == snapshot(
            name="reference"
        )

    async def test_duplicate(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that a user cannot be added to a reference if they are already a member."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user_1.id},
                "users": [{"id": user_2.id, "build": True, "modify_otu": True}],
            },
        )

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_user(
                "foo",
                CreateReferenceUserRequest(
                    build=True,
                    modify_otu=True,
                    user_id=user_2.id,
                ),
            )

        assert "User already exists" in str(err)

    async def test_not_found(self, data_layer: DataLayer, fake: DataFaker):
        """Test that a `NotFound` error is raised when the reference does not exist."""
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.create_user(
                "foo",
                CreateReferenceUserRequest(
                    build=True, modify_otu=True, user_id=user.id
                ),
            )

    async def test_user_does_not_exist(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that a `NotFound` error is raised when the user does not exist."""
        user = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_user(
                "foo",
                CreateReferenceUserRequest(build=True, modify_otu=True, user_id=99),
            )

        assert "User does not exist" in str(err)


class TestUpdateUser:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that the rights of a reference user can be updated."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user_1.id},
                "users": [
                    {
                        "id": user_2.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                ],
            },
        )

        assert await data_layer.references.update_user(
            "foo",
            user_2.id,
            ReferenceRightsRequest(
                modify_otu=False,
            ),
        ) == snapshot(name="obj_1")

        assert await data_layer.references.update_user(
            "foo",
            user_2.id,
            ReferenceRightsRequest(
                modify=True,
                modify_otu=True,
            ),
        ) == snapshot(name="obj_2")

        assert await mongo.references.find_one() == snapshot(name="mongo")

    @pytest.mark.parametrize("reference_exists", [True, False])
    async def test_not_found(
        self,
        reference_exists: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference user
        do not exist.
        """
        user_1 = await fake.users.create()

        if reference_exists:
            await mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "internal_control": None,
                    "name": "Foo",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user_1.id},
                    "users": [],
                },
            )

        with pytest.raises(ResourceNotFoundError):
            assert await data_layer.references.update_user(
                "foo",
                user_1.id,
                ReferenceRightsRequest(
                    modify_otu=False,
                ),
            )


class TestDeleteUser:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that a user can be deleted from a reference."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user_1.id},
                "users": [
                    {
                        "id": user_2.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                ],
            },
        )

        assert await data_layer.references.delete_user("foo", user_2.id) is None

        document = await mongo.references.find_one()
        assert document["users"] == []
        assert document == snapshot

    @pytest.mark.parametrize(
        "reference_exists",
        [True, False],
        ids=["reference_exists", "reference_does_not_exist"],
    )
    async def test_not_found(
        self,
        reference_exists: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference user
        do not exist.
        """
        user_1 = await fake.users.create()

        if reference_exists:
            await mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "internal_control": None,
                    "name": "Foo",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user_1.id},
                    "users": [],
                },
            )

        with pytest.raises(ResourceNotFoundError):
            assert await data_layer.references.delete_user("foo", "bar")


class TestCreateGroup:
    async def test_ok_and_duplicate(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that a group can be added to a reference."""
        user = await fake.users.create()
        group = await fake.groups.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        assert await data_layer.references.create_group(
            "foo",
            CreateReferenceGroupRequest(
                build=True,
                modify_otu=True,
                group_id=group.id,
            ),
        ) == snapshot(name="obj")

        assert await mongo.references.find_one() == snapshot(name="mongo")

        # Try creating again to make sure an error is raised if the group already
        # exists.
        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_group(
                "foo",
                CreateReferenceGroupRequest(
                    build=True,
                    modify_otu=True,
                    group_id=group.id,
                ),
            )

        assert "Group already exists" in str(err)

    async def test_not_found(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that `ResourceNotFound` is raised when the reference does not exist."""
        group = await fake.groups.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.create_group(
                "foo",
                CreateReferenceGroupRequest(
                    build=True,
                    modify_otu=True,
                    group_id=group.id,
                ),
            )

    async def test_group_does_not_exist(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that `ResourceNotFound` is raised when the group does not exist."""
        user = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_group(
                "foo",
                CreateReferenceGroupRequest(build=True, modify_otu=True, group_id=21),
            )

        assert "Group does not exist" in str(err)


class TestUpdateGroup:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that the rights of a reference group can be updated."""
        user = await fake.users.create()
        group = await fake.groups.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [
                    {
                        "id": group.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                ],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        assert await data_layer.references.update_group(
            "foo",
            group.id,
            ReferenceRightsRequest(build=False, modify=True),
        ) == snapshot(name="obj")

        assert await mongo.references.find_one() == snapshot(name="mongo")

    @pytest.mark.parametrize(
        "reference_exists",
        [True, False],
        ids=["reference_exists", "reference_does_not_exist"],
    )
    async def test_not_found(
        self,
        reference_exists: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference group
        do not exist.
        """
        user = await fake.users.create()

        if reference_exists:
            await mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "internal_control": None,
                    "name": "Foo",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user.id},
                    "users": [],
                },
            )

        with pytest.raises(ResourceNotFoundError):
            assert await data_layer.references.update_group(
                "foo",
                "bar",
                ReferenceRightsRequest(
                    modify_otu=False,
                ),
            )


class TestDeleteGroup:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot,
        static_time,
    ):
        """Test that a group can be deleted from a reference."""
        user = await fake.users.create()
        group = await fake.groups.create()

        await mongo.references.insert_one(
            {
                "_id": "foo",
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [
                    {
                        "id": group.id,
                        "build": True,
                        "created_at": static_time.datetime,
                        "modify": False,
                        "modify_otu": True,
                        "remove": False,
                    },
                ],
                "internal_control": None,
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        assert await data_layer.references.delete_group("foo", group.id) is None

        document = await mongo.references.find_one()
        assert document["groups"] == []
        assert document == snapshot

    @pytest.mark.parametrize(
        "reference_exists",
        [True, False],
        ids=["reference_exists", "reference_does_not_exist"],
    )
    async def test_not_found(
        self,
        reference_exists: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference group
        do not exist.
        """
        user = await fake.users.create()

        if reference_exists:
            await mongo.references.insert_one(
                {
                    "_id": "foo",
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "internal_control": None,
                    "name": "Foo",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user.id},
                    "users": [],
                },
            )

        with pytest.raises(ResourceNotFoundError):
            assert await data_layer.references.delete_group("foo", "bar")
