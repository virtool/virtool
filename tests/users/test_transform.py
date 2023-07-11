from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.models.enums import Permission

from virtool.groups.pg import SQLGroup
from virtool.mongo.transforms import apply_transforms
from virtool.users.transforms import AttachPermissionsTransform


async def test_permission_transform(fake2, pg, mongo, snapshot):

    group = await fake2.groups.create(
        permissions={Permission.create_sample.value: True}
    )

    await fake2.groups.create(permissions={Permission.create_ref: True})

    assert await apply_transforms(
        [{"id": 5, "groups": [dict(group)]}, {"id": 2, "groups": [group.id]}],
        [AttachPermissionsTransform(pg, mongo)],
    ) == snapshot(name="dict_group")

    group.permissions.cancel_job = True

    async with AsyncSession(pg) as session:
        await session.execute(
            update(SQLGroup)
            .where(SQLGroup.legacy_id == group.id)
            .values(permissions=group.permissions)
        )
        await session.commit()

    assert await apply_transforms(
        [{"id": 5, "groups": [dict(group)]}],
        [AttachPermissionsTransform(pg, mongo)],
    ) == snapshot(name="postgres_priority")
