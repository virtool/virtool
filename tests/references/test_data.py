import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.references.oas import (
    CreateReferenceGroupRequest,
    CreateReferenceRequest,
    CreateReferenceUserRequest,
    ReferenceRightsRequest,
    UpdateReferenceRequest,
)
from virtool.references.sql import (
    SQLReference,
    SQLReferenceGroup,
    SQLReferenceUser,
)


async def _reference_pk(pg: AsyncEngine, ref_id: str) -> int:
    async with AsyncSession(pg) as session:
        return (
            await session.execute(
                select(SQLReference.id).where(SQLReference.legacy_id == ref_id),
            )
        ).scalar_one()


async def _reference_user_row(
    pg: AsyncEngine,
    ref_id: str,
    user_id: int,
) -> SQLReferenceUser | None:
    reference_pk = await _reference_pk(pg, ref_id)

    async with AsyncSession(pg) as session:
        return (
            await session.execute(
                select(SQLReferenceUser).where(
                    SQLReferenceUser.reference_id == reference_pk,
                    SQLReferenceUser.user_id == user_id,
                ),
            )
        ).scalar_one_or_none()


async def _reference_group_row(
    pg: AsyncEngine,
    ref_id: str,
    group_id: int,
) -> SQLReferenceGroup | None:
    reference_pk = await _reference_pk(pg, ref_id)

    async with AsyncSession(pg) as session:
        return (
            await session.execute(
                select(SQLReferenceGroup).where(
                    SQLReferenceGroup.reference_id == reference_pk,
                    SQLReferenceGroup.group_id == group_id,
                ),
            )
        ).scalar_one_or_none()


class TestReferenceRightsDualWrite:
    """Reference rights writes land in the Postgres child tables."""

    async def test_create_user(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        owner = await fake.users.create()
        member = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"),
            owner.id,
        )

        await data_layer.references.create_user(
            reference.id,
            CreateReferenceUserRequest(build=True, modify_otu=True, user_id=member.id),
        )

        row = await _reference_user_row(pg, reference.id, member.id)

        assert row is not None
        assert (row.build, row.modify, row.modify_otu) == (True, False, True)

    async def test_update_user(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        owner = await fake.users.create()
        member = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"),
            owner.id,
        )

        await data_layer.references.create_user(
            reference.id,
            CreateReferenceUserRequest(build=True, user_id=member.id),
        )

        await data_layer.references.update_user(
            reference.id,
            member.id,
            ReferenceRightsRequest(modify=True, build=False),
        )

        row = await _reference_user_row(pg, reference.id, member.id)

        assert (row.build, row.modify) == (False, True)

    async def test_delete_user(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        owner = await fake.users.create()
        member = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"),
            owner.id,
        )

        await data_layer.references.create_user(
            reference.id,
            CreateReferenceUserRequest(build=True, user_id=member.id),
        )

        await data_layer.references.delete_user(reference.id, member.id)

        assert await _reference_user_row(pg, reference.id, member.id) is None

    async def test_create_group(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        owner = await fake.users.create()
        group = await fake.groups.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"),
            owner.id,
        )

        await data_layer.references.create_group(
            reference.id,
            CreateReferenceGroupRequest(group_id=group.id, build=True, modify_otu=True),
        )

        row = await _reference_group_row(pg, reference.id, group.id)

        assert row is not None
        assert (row.build, row.modify, row.modify_otu) == (True, False, True)

    async def test_update_group(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        owner = await fake.users.create()
        group = await fake.groups.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"),
            owner.id,
        )

        await data_layer.references.create_group(
            reference.id,
            CreateReferenceGroupRequest(group_id=group.id, build=True),
        )

        await data_layer.references.update_group(
            reference.id,
            group.id,
            ReferenceRightsRequest(modify=True, build=False),
        )

        row = await _reference_group_row(pg, reference.id, group.id)

        assert (row.build, row.modify) == (False, True)

    async def test_delete_group(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        owner = await fake.users.create()
        group = await fake.groups.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"),
            owner.id,
        )

        await data_layer.references.create_group(
            reference.id,
            CreateReferenceGroupRequest(group_id=group.id, build=True),
        )

        await data_layer.references.delete_group(reference.id, group.id)

        assert await _reference_group_row(pg, reference.id, group.id) is None


class TestCreate:
    async def test_dual_write(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """A created reference and its seeded owner rights land in both stores."""
        user = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example", organism="virus"),
            user.id,
        )

        assert await mongo.references.find_one(reference.id) is not None

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLReference).where(
                        SQLReference.legacy_id == reference.id,
                    ),
                )
            ).scalar_one()

            assert row.name == "Example"
            assert row.organism == "virus"
            assert row.user_id == user.id
            assert row.archived is False

            members = (
                (
                    await session.execute(
                        select(SQLReferenceUser).where(
                            SQLReferenceUser.reference_id == row.id,
                        ),
                    )
                )
                .scalars()
                .all()
            )

        assert len(members) == 1
        assert members[0].user_id == user.id
        assert (members[0].build, members[0].modify, members[0].modify_otu) == (
            True,
            True,
            True,
        )

    async def test_clone_resolves_source_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Cloning links the new Postgres row to the source reference's primary key."""
        user = await fake.users.create()

        source = await data_layer.references.create(
            CreateReferenceRequest(name="Source"),
            user.id,
        )

        clone = await data_layer.references.create(
            CreateReferenceRequest(name="Clone", clone_from=source.id),
            user.id,
        )

        async with AsyncSession(pg) as session:
            source_id = (
                await session.execute(
                    select(SQLReference.id).where(
                        SQLReference.legacy_id == source.id,
                    ),
                )
            ).scalar_one()

            clone_row = (
                await session.execute(
                    select(SQLReference).where(
                        SQLReference.legacy_id == clone.id,
                    ),
                )
            ).scalar_one()

        assert clone_row.cloned_from_id == source_id

    async def test_import_sets_upload_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Importing records the source upload as the Postgres foreign key."""
        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Imported", import_from=upload.id),
            user.id,
        )

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLReference).where(
                        SQLReference.legacy_id == reference.id,
                    ),
                )
            ).scalar_one()

        assert row.upload_id == upload.id

    async def test_rolls_back_mongo_on_postgres_failure(
        self,
        data_layer: DataLayer,
        mongo: Mongo,
    ):
        """A failed Postgres write rolls the Mongo insert back, leaving neither."""
        with pytest.raises(IntegrityError):
            await data_layer.references.create(
                CreateReferenceRequest(name="Example"),
                999999,
            )

        assert await mongo.references.count_documents({}) == 0


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
                "archived": False,
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

    async def test_dual_write(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Updating persisted columns writes through to Postgres."""
        user = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Before", organism="virus"),
            user.id,
        )

        await data_layer.references.update(
            reference.id,
            UpdateReferenceRequest(name="After", organism="bacteria"),
        )

        document = await mongo.references.find_one(reference.id)
        assert document["name"] == "After"

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLReference).where(
                        SQLReference.legacy_id == reference.id,
                    ),
                )
            ).scalar_one()

        assert row.name == "After"
        assert row.organism == "bacteria"

    async def test_skips_postgres_when_row_absent(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time,
    ):
        """A Mongo-only reference still updates Mongo without a Postgres row."""
        user = await fake.users.create()

        await mongo.references.insert_one(
            {
                "_id": "mongo_only",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "Mongo only.",
                "groups": [],
                "internal_control": None,
                "name": "Before",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        await data_layer.references.update(
            "mongo_only",
            UpdateReferenceRequest(name="After"),
        )

        document = await mongo.references.find_one("mongo_only")
        assert document["name"] == "After"

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLReference).where(
                        SQLReference.legacy_id == "mongo_only",
                    ),
                )
            ).scalar_one_or_none()

        assert row is None


class TestArchive:
    async def test_dual_write(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Archiving and unarchiving flips the flag in both stores."""
        user = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"),
            user.id,
        )

        await data_layer.references.archive(reference.id)

        assert (await mongo.references.find_one(reference.id))["archived"] is True

        async with AsyncSession(pg) as session:
            assert (
                await session.execute(
                    select(SQLReference.archived).where(
                        SQLReference.legacy_id == reference.id,
                    ),
                )
            ).scalar_one() is True

        await data_layer.references.unarchive(reference.id)

        assert (await mongo.references.find_one(reference.id))["archived"] is False

        async with AsyncSession(pg) as session:
            assert (
                await session.execute(
                    select(SQLReference.archived).where(
                        SQLReference.legacy_id == reference.id,
                    ),
                )
            ).scalar_one() is False


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
                "archived": False,
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
                "archived": False,
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
                "archived": False,
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
                    "archived": False,
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
                "archived": False,
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
                    "archived": False,
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
                "archived": False,
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
                "archived": False,
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
                "archived": False,
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
                    "archived": False,
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
                "archived": False,
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
                    "archived": False,
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
