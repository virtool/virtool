import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.mongo.core import Mongo
from virtool.references.oas import (
    CreateReferenceGroupRequest,
    CreateReferenceRequest,
    CreateReferenceUserRequest,
    ReferenceRightsRequest,
    UpdateReferenceRequest,
)
from virtool.references.sql import SQLReference
from virtool.tasks.sql import SQLTask


class TestCreate:
    async def test_clone_resolves_source_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Cloning links the new reference to the source reference's primary key."""
        user = await fake.users.create()

        source = await data_layer.references.create(
            CreateReferenceRequest(name="Source"),
            user.id,
        )

        clone = await data_layer.references.create(
            CreateReferenceRequest(name="Clone", clone_from=source.id),
            user.id,
        )

        cloned = await data_layer.references.get(clone.id)

        assert cloned.cloned_from.id == source.id

    async def test_import_sets_upload_id(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Importing records the source upload on the reference."""
        user = await fake.users.create()
        upload = await fake.uploads.create(user=user)

        reference = await data_layer.references.create(
            CreateReferenceRequest(name="Imported", import_from=upload.id),
            user.id,
        )

        imported = await data_layer.references.get(reference.id)

        assert imported.imported_from.id == upload.id

    async def test_rolls_back_on_postgres_failure(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
    ):
        """A create that fails partway leaves no reference row behind.

        The owner-rights insert violates the user FK, rolling back the reference row
        inserted earlier in the same transaction.
        """
        nonexistent_user_id = 999999

        with pytest.raises(IntegrityError):
            await data_layer.references.create(
                CreateReferenceRequest(name="Example"),
                nonexistent_user_id,
            )

        async with AsyncSession(pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLReference).where(SQLReference.name == "Example"),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == []


class TestCreateIndex:
    async def test_rolls_back_task_index_and_history_on_failure(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mocker,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time,
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        async with AsyncSession(pg) as session:
            session.add(
                SQLLegacyHistory(
                    legacy_id="unbuilt_change",
                    created_at=static_time.datetime,
                    description="Created OTU",
                    method_name="create",
                    user_id=user.id,
                    otu="otu_1",
                    otu_name="Tobacco mosaic virus",
                    otu_version="0",
                    reference_id=reference.id,
                    index=None,
                    index_version=None,
                ),
            )
            await session.commit()

        mocker.patch(
            "virtool.indexes.db.update",
            side_effect=RuntimeError("history assignment failed"),
        )

        with pytest.raises(RuntimeError, match="history assignment failed"):
            await data_layer.references.create_index(reference.id, user.id)

        assert await mongo.indexes.find_one() is None

        async with AsyncSession(pg) as session:
            history = await session.scalar(
                select(SQLLegacyHistory).where(
                    SQLLegacyHistory.legacy_id == "unbuilt_change",
                ),
            )

            assert history is not None
            assert history.index is None
            assert history.index_version is None
            assert await session.scalar(select(SQLTask.id)) is None


class TestUpdate:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        await data_layer.references.update(
            reference.id,
            UpdateReferenceRequest(name="After"),
        )

        updated = await data_layer.references.get(reference.id)

        assert updated.name == "After"

    async def test_archived(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """An archived reference cannot be updated."""
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        await data_layer.references.archive(reference.id)

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.update(
                reference.id,
                UpdateReferenceRequest(name="After"),
            )

        assert "Reference is archived" in str(err.value)

    async def test_not_found(self, data_layer: DataLayer):
        """Updating a reference that does not exist raises a not-found error."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.update(
                999999,
                UpdateReferenceRequest(name="After"),
            )


class TestCreateUser:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
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
    ):
        """Test that a user cannot be added to a reference if they are already a member."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        reference = await fake.references.create(user=user_1)

        await data_layer.references.create_user(
            reference.id,
            CreateReferenceUserRequest(build=True, modify_otu=True, user_id=user_2.id),
        )

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_user(
                reference.id,
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
    ):
        """Test that a `NotFound` error is raised when the user does not exist."""
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_user(
                reference.id,
                CreateReferenceUserRequest(build=True, modify_otu=True, user_id=99),
            )

        assert "User does not exist" in str(err)


class TestUpdateUser:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot,
        static_time,
    ):
        """Test that the rights of a reference user can be updated."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        reference = await fake.references.create(user=user_1)

        await data_layer.references.create_user(
            reference.id,
            CreateReferenceUserRequest(build=True, modify_otu=True, user_id=user_2.id),
        )

        assert await data_layer.references.update_user(
            reference.id,
            user_2.id,
            ReferenceRightsRequest(
                modify_otu=False,
            ),
        ) == snapshot(name="obj_1")

        assert await data_layer.references.update_user(
            reference.id,
            user_2.id,
            ReferenceRightsRequest(
                modify=True,
                modify_otu=True,
            ),
        ) == snapshot(name="obj_2")

    async def test_reference_not_found(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test ``ResourceNotFound`` is raised when the reference does not exist."""
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.update_user(
                "foo",
                user.id,
                ReferenceRightsRequest(modify_otu=False),
            )

    async def test_user_not_a_member(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that ``ResourceNotFound`` is raised when the user is not a member of the
        reference.
        """
        owner = await fake.users.create()
        non_member = await fake.users.create()

        reference = await fake.references.create(user=owner)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.update_user(
                reference.id,
                non_member.id,
                ReferenceRightsRequest(modify_otu=False),
            )


class TestDeleteUser:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that a user can be deleted from a reference."""
        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        reference = await fake.references.create(user=user_1)

        await data_layer.references.create_user(
            reference.id,
            CreateReferenceUserRequest(build=True, modify_otu=True, user_id=user_2.id),
        )

        assert await data_layer.references.delete_user(reference.id, user_2.id) is None

        reference = await data_layer.references.get(reference.id)
        assert [member.id for member in reference.users] == [user_1.id]

    async def test_reference_not_found(
        self,
        data_layer: DataLayer,
    ):
        """Test ``ResourceNotFound`` is raised when the reference does not exist."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.delete_user("foo", 999999)

    async def test_user_not_a_member(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that ``ResourceNotFound`` is raised when the user is not a member of the
        reference.
        """
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.delete_user(reference.id, 999999)


class TestCreateGroup:
    async def test_ok_and_duplicate(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot,
        static_time,
    ):
        """Test that a group can be added to a reference."""
        user = await fake.users.create()
        group = await fake.groups.create()

        reference = await fake.references.create(user=user)

        assert await data_layer.references.create_group(
            reference.id,
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
                reference.id,
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
    ):
        """Test that `ResourceNotFound` is raised when the group does not exist."""
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        with pytest.raises(ResourceConflictError) as err:
            await data_layer.references.create_group(
                reference.id,
                CreateReferenceGroupRequest(
                    build=True, modify_otu=True, group_id=999999
                ),
            )

        assert "Group does not exist" in str(err)


class TestUpdateGroup:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot,
        static_time,
    ):
        """Test that the rights of a reference group can be updated."""
        user = await fake.users.create()
        group = await fake.groups.create()

        reference = await fake.references.create(user=user)

        await data_layer.references.create_group(
            reference.id,
            CreateReferenceGroupRequest(build=True, modify_otu=True, group_id=group.id),
        )

        assert await data_layer.references.update_group(
            reference.id,
            group.id,
            ReferenceRightsRequest(build=False, modify=True),
        ) == snapshot(name="obj")

    async def test_reference_not_found(
        self,
        data_layer: DataLayer,
    ):
        """Test ``ResourceNotFound`` is raised when the reference does not exist."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.update_group(
                "foo",
                999999,
                ReferenceRightsRequest(modify_otu=False),
            )

    async def test_group_not_a_member(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test ``ResourceNotFound`` is raised when the group is not attached to the
        reference.
        """
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.update_group(
                reference.id,
                999999,
                ReferenceRightsRequest(modify_otu=False),
            )


class TestDeleteGroup:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test that a group can be deleted from a reference."""
        user = await fake.users.create()
        group = await fake.groups.create()

        reference = await fake.references.create(user=user)

        await data_layer.references.create_group(
            reference.id,
            CreateReferenceGroupRequest(build=True, modify_otu=True, group_id=group.id),
        )

        assert await data_layer.references.delete_group(reference.id, group.id) is None

        reference = await data_layer.references.get(reference.id)
        assert reference.groups == []

    async def test_reference_not_found(
        self,
        data_layer: DataLayer,
    ):
        """Test ``ResourceNotFound`` is raised when the reference does not exist."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.delete_group("foo", 999999)

    async def test_group_not_a_member(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """Test ``ResourceNotFound`` is raised when the group is not attached to the
        reference.
        """
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.delete_group(reference.id, 999999)
