from datetime import datetime

import pytest
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
                "primary_group": "none",
            },
            [AttachPrimaryGroupTransform(pg)],
        )

        assert result == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    @pytest.mark.parametrize("legacy", [True, False])
    async def test_single_document(self, legacy: bool, pg: AsyncEngine, snapshot):
        """Test that the primary group is attached to a single document and the transform works"""
        async with AsyncSession(pg) as session:
            session.add(
                SQLGroup(
                    name="group_1",
                    permissions={"modify": True, "remove": True},
                    legacy_id="group_1",
                )
            )

            await session.commit()

        result = await apply_transforms(
            {
                "id": "bob",
                "primary_group": "group_1" if legacy else 1,
            },
            [AttachPrimaryGroupTransform(pg)],
        )

        assert result == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_multiple_documents(self, no_permissions, pg: AsyncEngine, snapshot):
        """Test that the primary group is attached to multiple documents and the transform
        works with legacy ids.
        """
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLGroup(
                        name="group_1", legacy_id="group_1", permissions=no_permissions
                    ),
                    SQLGroup(
                        name="group_2", legacy_id="group_2", permissions=no_permissions
                    ),
                ]
            )

            await session.commit()

        result = await apply_transforms(
            [
                {"id": "bob", "primary_group": "group_1"},
                {"id": "joe", "primary_group": "group_2"},
                {"id": "jim", "primary_group": 1},
            ],
            [AttachPrimaryGroupTransform(pg)],
        )

        assert result == snapshot(
            matcher=path_type(
                {".*last_password_change": (datetime,), ".*password": (bytes,)},
                regex=True,
            )
        )


class TestAttachGroups:
    @pytest.mark.parametrize("no_groups", [True, False])
    async def test_single_document(
        self,
        no_groups: bool,
        no_permissions: dict[str, bool],
        pg: AsyncEngine,
        snapshot,
    ):
        """Test that the transform works with a single document with:
        * ``groups`` is empty
        * ``groups`` contains both legacy and modern group ids

        """
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLGroup(
                        name="group_1", legacy_id="group_1", permissions=no_permissions
                    ),
                    SQLGroup(
                        name="group_2", legacy_id="group_2", permissions=no_permissions
                    ),
                    SQLGroup(
                        name="group_3", legacy_id="group_3", permissions=no_permissions
                    ),
                ]
            )

            await session.commit()

        result = await apply_transforms(
            {"id": "bob", "groups": [] if no_groups else ["group_1", 2]},
            [AttachGroupsTransform(pg)],
        )

        assert result == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_multiple_documents(
        self, no_permissions: dict[str, bool], pg: AsyncEngine, snapshot
    ):
        """Test that the transform works with multiple documents with:
        * ``groups`` is empty
        * ``groups`` contains both legacy and modern group ids
        * ``groups`` contains only legacy group ids
        * ``groups`` contains only modern group ids

        """
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLGroup(
                        name="group_1",
                        permissions=no_permissions,
                        legacy_id="group_1",
                    ),
                    SQLGroup(
                        name="group_2",
                        permissions=no_permissions,
                        legacy_id="group_2",
                    ),
                    SQLGroup(
                        name="group_3",
                        permissions=no_permissions,
                        legacy_id="group_3",
                    ),
                ]
            )

            await session.commit()

        result = await apply_transforms(
            [
                {"id": "bob", "groups": ["group_1", 2]},
                {"id": "joe", "groups": []},
                {"id": "jim", "groups": [2, 3]},
                {"id": "ned", "groups": ["group_2", "group_1"]},
            ],
            [AttachGroupsTransform(pg)],
        )

        assert result == snapshot(
            matcher=path_type(
                {".*last_password_change": (datetime,), ".*password": (bytes,)},
                regex=True,
            )
        )
