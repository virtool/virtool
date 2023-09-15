from datetime import datetime

from syrupy.matchers import path_type

from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker
from virtool.groups.transforms import AttachGroupsTransform, AttachPrimaryGroupTransform
from virtool.mongo.core import Mongo
from virtool.utils import base_processor


class TestAttachPrimaryGroup:
    async def test_no_primary_group(self, snapshot, fake2, mongo):
        user = await fake2.users.create()

        incomplete_user = base_processor(await mongo.users.find_one({"_id": user.id}))

        assert await apply_transforms(
            incomplete_user,
            [AttachGroupsTransform(mongo), AttachPrimaryGroupTransform(mongo)],
        ) == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_single_document(self, snapshot, fake2: DataFaker, mongo: Mongo):
        group = await fake2.groups.create()
        user = await fake2.users.create(groups=[group], primary_group=group)

        incomplete_user = base_processor(await mongo.users.find_one({"_id": user.id}))

        assert await apply_transforms(
            incomplete_user,
            [AttachGroupsTransform(mongo), AttachPrimaryGroupTransform(mongo)],
        ) == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_multiple_documents(self, snapshot, fake2, mongo):
        group_0 = await fake2.groups.create()
        group_1 = await fake2.groups.create()

        user_0 = await fake2.users.create(groups=[group_0], primary_group=group_0)
        user_1 = await fake2.users.create(groups=[group_1], primary_group=group_1)

        incomplete_users = [
            base_processor(await mongo.users.find_one({"_id": user_0.id})),
            base_processor(await mongo.users.find_one({"_id": user_1.id})),
        ]

        assert await apply_transforms(
            incomplete_users,
            [AttachGroupsTransform(mongo), AttachPrimaryGroupTransform(mongo)],
        ) == snapshot(
            matcher=path_type(
                {".*last_password_change": (datetime,), ".*password": (bytes,)},
                regex=True,
            )
        )


class TestAttachGroups:
    async def test_no_groups(self, snapshot, fake2, mongo):
        user = await fake2.users.create()

        incomplete_user = base_processor(await mongo.users.find_one({"_id": user.id}))

        assert await apply_transforms(
            incomplete_user, [AttachGroupsTransform(mongo)]
        ) == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_single_document(self, snapshot, fake2, mongo):
        user = await fake2.users.create(
            groups=[
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
            ]
        )

        incomplete_user = base_processor(await mongo.users.find_one({"_id": user.id}))

        assert await apply_transforms(
            incomplete_user, [AttachGroupsTransform(mongo)]
        ) == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_multiple_documents(self, snapshot, fake2, mongo):
        user_0 = await fake2.users.create(
            groups=[
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
            ]
        )
        user_1 = await fake2.users.create(
            groups=[
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
            ]
        )

        incomplete_users = [
            base_processor(await mongo.users.find_one({"_id": user_0.id})),
            base_processor(await mongo.users.find_one({"_id": user_1.id})),
        ]

        assert await apply_transforms(
            incomplete_users,
            [AttachGroupsTransform(mongo), AttachPrimaryGroupTransform(mongo)],
        ) == snapshot(
            matcher=path_type(
                {".*last_password_change": (datetime,), ".*password": (bytes,)},
                regex=True,
            )
        )
