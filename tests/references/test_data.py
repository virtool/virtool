import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.data.topg import both_transactions
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.references.db import write_legacy_reference
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
from virtool.tasks.sql import SQLTask


async def insert_reference(mongo: Mongo, pg: AsyncEngine, document: dict) -> None:
    """Insert a reference into Mongo and mirror it (row and rights) into Postgres."""
    async with both_transactions(mongo, pg) as (mongo_session, pg_session):
        await mongo.references.insert_one(document, session=mongo_session)
        await write_legacy_reference(pg_session, document)


async def _reference_user_row(
    pg: AsyncEngine,
    reference_pk: int,
    user_id: int,
) -> SQLReferenceUser | None:
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
    reference_pk: int,
    group_id: int,
) -> SQLReferenceGroup | None:
    async with AsyncSession(pg) as session:
        return (
            await session.execute(
                select(SQLReferenceGroup).where(
                    SQLReferenceGroup.reference_id == reference_pk,
                    SQLReferenceGroup.group_id == group_id,
                ),
            )
        ).scalar_one_or_none()


class TestFakeReferenceBuilder:
    """The fake builder creates native references, with an opt-in for legacy ones."""

    async def test_native_by_default(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        async with AsyncSession(pg) as session:
            legacy_id = await session.scalar(
                select(SQLReference.legacy_id).where(
                    SQLReference.id == reference.id,
                ),
            )

        assert legacy_id is None

    async def test_use_legacy_id(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        user = await fake.users.create()

        reference = await fake.references.create(user=user, use_legacy_id=True)

        async with AsyncSession(pg) as session:
            legacy_id = await session.scalar(
                select(SQLReference.legacy_id).where(
                    SQLReference.id == reference.id,
                ),
            )

        assert legacy_id is not None


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
    async def test_writes_postgres(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A created reference and its seeded owner rights land in Postgres."""
        user = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example", organism="virus"),
            user.id,
        )

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLReference).where(SQLReference.id == reference.id),
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
            clone_row = (
                await session.execute(
                    select(SQLReference).where(SQLReference.id == clone.id),
                )
            ).scalar_one()

        assert clone_row.cloned_from_id == source.id

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
                    select(SQLReference).where(SQLReference.id == reference.id),
                )
            ).scalar_one()

        assert row.upload_id == upload.id

    async def test_native_no_legacy_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A reference created through the data layer is Postgres-native: its primary
        key is the public id and its ``legacy_id`` is ``NULL``.
        """
        user = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Native"),
            user.id,
        )

        assert isinstance(reference.id, int)

        async with AsyncSession(pg) as session:
            legacy_id = await session.scalar(
                select(SQLReference.legacy_id).where(
                    SQLReference.id == reference.id,
                ),
            )

        assert legacy_id is None

    async def test_import_task_keyed_by_pk(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """The import population task is handed the integer primary key, not a legacy
        id, so it can locate a Postgres-native reference.
        """
        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Imported", import_from=upload.id),
            user.id,
        )

        async with AsyncSession(pg) as session:
            task_id = await session.scalar(
                select(SQLReference.task_id).where(
                    SQLReference.id == reference.id,
                ),
            )

            task = await session.get(SQLTask, task_id)

        assert task.context["ref_id"] == reference.id

    async def test_rolls_back_on_postgres_failure(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
    ):
        """A failed Postgres write leaves no reference row behind."""
        with pytest.raises(IntegrityError):
            await data_layer.references.create(
                CreateReferenceRequest(name="Example"),
                999999,
            )

        async with AsyncSession(pg) as session:
            assert (await session.execute(select(SQLReference))).scalars().all() == []


class TestUpdate:
    async def test_writes_postgres(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLReference).where(SQLReference.id == reference.id),
                )
            ).scalar_one()

        assert row.name == "After"
        assert row.organism == "bacteria"

    async def test_postgres_native(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A Postgres-native reference (no ``legacy_id``) is addressed by its integer
        primary key and updates normally.
        """
        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            reference = SQLReference(
                legacy_id=None,
                name="Postgres Native",
                description="",
                organism="virus",
                created_at=virtool.utils.timestamp(),
                source_types=[],
                user_id=user.id,
            )
            session.add(reference)
            await session.flush()
            reference_id = reference.id
            await session.commit()

        await data_layer.references.update(
            reference_id,
            UpdateReferenceRequest(name="After"),
        )

        async with AsyncSession(pg) as session:
            row = (
                await session.execute(
                    select(SQLReference).where(SQLReference.id == reference_id),
                )
            ).scalar_one()

        assert row.name == "After"


class TestArchive:
    async def test_writes_postgres(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Archiving and unarchiving flips the flag in Postgres."""
        user = await fake.users.create()

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Example"),
            user.id,
        )

        await data_layer.references.archive(reference.id)

        async with AsyncSession(pg) as session:
            assert (
                await session.execute(
                    select(SQLReference.archived).where(
                        SQLReference.id == reference.id,
                    ),
                )
            ).scalar_one() is True

        await data_layer.references.unarchive(reference.id)

        async with AsyncSession(pg) as session:
            assert (
                await session.execute(
                    select(SQLReference.archived).where(
                        SQLReference.id == reference.id,
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
        pg: AsyncEngine,
    ):
        """Test that a user cannot be added to a reference if they are already a member."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
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
        pg: AsyncEngine,
    ):
        """Test that a `NotFound` error is raised when the user does not exist."""
        user = await fake.users.create()

        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
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
        pg: AsyncEngine,
        snapshot,
        static_time,
    ):
        """Test that the rights of a reference user can be updated."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
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

    @pytest.mark.parametrize("reference_exists", [True, False])
    async def test_not_found(
        self,
        reference_exists: bool,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        static_time,
        pg: AsyncEngine,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference user
        do not exist.
        """
        user_1 = await fake.users.create()

        if reference_exists:
            await insert_reference(
                mongo,
                pg,
                {
                    "_id": "foo",
                    "archived": False,
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
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
        pg: AsyncEngine,
        static_time,
    ):
        """Test that a user can be deleted from a reference."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
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

        reference = await data_layer.references.get("foo")
        assert reference.users == []

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
        pg: AsyncEngine,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference user
        do not exist.
        """
        user_1 = await fake.users.create()

        if reference_exists:
            await insert_reference(
                mongo,
                pg,
                {
                    "_id": "foo",
                    "archived": False,
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
                    "name": "Foo",
                    "organism": "virus",
                    "restrict_source_types": False,
                    "source_types": [],
                    "user": {"id": user_1.id},
                    "users": [],
                },
            )

        with pytest.raises(ResourceNotFoundError):
            assert await data_layer.references.delete_user("foo", 999999)


class TestCreateGroup:
    async def test_ok_and_duplicate(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot,
        static_time,
    ):
        """Test that a group can be added to a reference."""
        user = await fake.users.create()
        group = await fake.groups.create()

        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
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
        pg: AsyncEngine,
    ):
        """Test that `ResourceNotFound` is raised when the group does not exist."""
        user = await fake.users.create()

        await insert_reference(
            mongo,
            pg,
            {
                "_id": "foo",
                "archived": False,
                "created_at": static_time.datetime,
                "data_type": "genome",
                "description": "This is a test reference.",
                "groups": [],
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
        pg: AsyncEngine,
        snapshot,
        static_time,
    ):
        """Test that the rights of a reference group can be updated."""
        user = await fake.users.create()
        group = await fake.groups.create()

        await insert_reference(
            mongo,
            pg,
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
        pg: AsyncEngine,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference group
        do not exist.
        """
        user = await fake.users.create()

        if reference_exists:
            await insert_reference(
                mongo,
                pg,
                {
                    "_id": "foo",
                    "archived": False,
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
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
        pg: AsyncEngine,
        static_time,
    ):
        """Test that a group can be deleted from a reference."""
        user = await fake.users.create()
        group = await fake.groups.create()

        await insert_reference(
            mongo,
            pg,
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
                "name": "Foo",
                "organism": "virus",
                "restrict_source_types": False,
                "source_types": [],
                "user": {"id": user.id},
                "users": [],
            },
        )

        assert await data_layer.references.delete_group("foo", group.id) is None

        reference = await data_layer.references.get("foo")
        assert reference.groups == []

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
        pg: AsyncEngine,
    ):
        """Test that ``ResourceNotFound`` is raised when the reference or reference group
        do not exist.
        """
        user = await fake.users.create()

        if reference_exists:
            await insert_reference(
                mongo,
                pg,
                {
                    "_id": "foo",
                    "archived": False,
                    "created_at": static_time.datetime,
                    "data_type": "genome",
                    "description": "This is a test reference.",
                    "groups": [],
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
