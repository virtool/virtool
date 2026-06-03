from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.matchers import path_type

from virtool.data.transforms import apply_transforms
from virtool.groups.pg import SQLGroup
from virtool.groups.transforms import AttachGroupsTransform, AttachPrimaryGroupTransform


class TestAttachPrimaryGroup:
    async def test_no_primary_group(self, pg: AsyncEngine, snapshot):
        result = await apply_transforms(
            {
                "id": "bob",
                "primary_group": None,
            },
            [AttachPrimaryGroupTransform(pg)],
            pg,
        )

        assert result == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_single_document(self, pg: AsyncEngine, snapshot):
        """Test that the primary group is attached to a single document."""
        async with AsyncSession(pg) as session:
            session.add(
                SQLGroup(
                    name="group_1",
                    permissions={"modify": True, "remove": True},
                )
            )

            await session.commit()

        result = await apply_transforms(
            {
                "id": "bob",
                "primary_group": 1,
            },
            [AttachPrimaryGroupTransform(pg)],
            pg,
        )

        assert result == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_multiple_documents(self, no_permissions, pg: AsyncEngine, snapshot):
        """Test that the primary group is attached to multiple documents."""
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLGroup(name="group_1", permissions=no_permissions),
                    SQLGroup(name="group_2", permissions=no_permissions),
                ]
            )

            await session.commit()

        result = await apply_transforms(
            [
                {"id": "bob", "primary_group": 1},
                {"id": "joe", "primary_group": 2},
                {"id": "jim", "primary_group": None},
            ],
            [AttachPrimaryGroupTransform(pg)],
            pg,
        )

        assert result == snapshot(
            matcher=path_type(
                {".*last_password_change": (datetime,), ".*password": (bytes,)},
                regex=True,
            )
        )


class TestAttachGroups:
    async def test_no_groups(
        self, no_permissions: dict[str, bool], pg: AsyncEngine, snapshot
    ):
        """Test that a document with no groups is left with an empty groups list."""
        async with AsyncSession(pg) as session:
            session.add(SQLGroup(name="group_1", permissions=no_permissions))

            await session.commit()

        result = await apply_transforms(
            {"id": "bob", "groups": []},
            [AttachGroupsTransform(pg)],
            pg,
        )

        assert result == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_single_document(
        self, no_permissions: dict[str, bool], pg: AsyncEngine, snapshot
    ):
        """Test that groups are attached to a single document."""
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLGroup(name="group_1", permissions=no_permissions),
                    SQLGroup(name="group_2", permissions=no_permissions),
                    SQLGroup(name="group_3", permissions=no_permissions),
                ]
            )

            await session.commit()

        result = await apply_transforms(
            {"id": "bob", "groups": [1, 2]},
            [AttachGroupsTransform(pg)],
            pg,
        )

        assert result == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_multiple_documents(
        self, no_permissions: dict[str, bool], pg: AsyncEngine, snapshot
    ):
        """Test that groups are attached across multiple documents, including a
        document with no groups.
        """
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLGroup(name="group_1", permissions=no_permissions),
                    SQLGroup(name="group_2", permissions=no_permissions),
                    SQLGroup(name="group_3", permissions=no_permissions),
                ]
            )

            await session.commit()

        result = await apply_transforms(
            [
                {"id": "bob", "groups": [1, 2]},
                {"id": "joe", "groups": []},
                {"id": "jim", "groups": [2, 3]},
                {"id": "ned", "groups": [2, 1]},
            ],
            [AttachGroupsTransform(pg)],
            pg,
        )

        assert result == snapshot(
            matcher=path_type(
                {".*last_password_change": (datetime,), ".*password": (bytes,)},
                regex=True,
            )
        )
