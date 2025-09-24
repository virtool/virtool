import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.assertion import SnapshotAssertion

from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker
from virtool.groups.pg import SQLGroup
from virtool.users.transforms import AttachPermissionsTransform, AttachUserTransform


async def test_permission_transform(
    no_permissions: dict[str, bool],
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    """Test that the transform works with legacy and SQL ids, as well as a single document
    or a list of documents.
    """
    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLGroup(
                    name="group_1",
                    legacy_id="group_1",
                    permissions={
                        **no_permissions,
                        "modify_subtraction": True,
                        "upload_file": True,
                    },
                ),
                SQLGroup(
                    name="group_2",
                    legacy_id="group_2",
                    permissions={
                        **no_permissions,
                        "modify_subtraction": True,
                        "upload_file": True,
                    },
                ),
                SQLGroup(
                    name="group_3",
                    legacy_id="group_3",
                    permissions={**no_permissions, "create_sample": True},
                ),
                SQLGroup(
                    name="group_4",
                    legacy_id="group_4",
                    permissions=no_permissions,
                ),
                SQLGroup(
                    name="group_5",
                    legacy_id="group_5",
                    permissions={**no_permissions, "create_ref": True},
                ),
            ],
        )

        await session.commit()

    assert await apply_transforms(
        {"id": "bob", "groups": [1, "group_5"]},
        [AttachPermissionsTransform(pg)],
    ) == snapshot(name="single")

    assert await apply_transforms(
        [
            {"id": "joe", "groups": [1, "group_5"]},
            {"id": "mae", "groups": [3, 4]},
            {"id": "wil", "groups": []},
            {"id": "pam", "groups": ["group_2"]},
        ],
        [AttachPermissionsTransform(pg)],
    ) == snapshot(name="multi")


@pytest.mark.parametrize("multiple", [True, False])
async def test_attach_user_transform(
    multiple: bool,
    fake: DataFaker,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    documents = {"id": "bar", "user": {"id": user_1.id}}

    if multiple:
        documents = [
            documents,
            {"id": "foo", "user": {"id": user_2.id}},
            {"id": "baz", "user": {"id": user_1.id}},
        ]

    assert await apply_transforms(documents, [AttachUserTransform(pg)]) == snapshot
