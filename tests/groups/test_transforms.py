from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy.matchers import path_type

from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker
from virtool.groups.transforms import AttachGroupsTransform, AttachPrimaryGroupTransform
from virtool.mongo.core import Mongo
from virtool.utils import base_processor


class TestAttachPrimaryGroup:
    async def test_no_primary_group(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        await mongo.users.insert_one(
            {
                "_id": "bob",
                "primary_group": "none",
            }
        )

        assert await apply_transforms(
            base_processor(await mongo.users.find_one({"_id": "bob"})),
            [AttachPrimaryGroupTransform(pg)],
        ) == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_single_document(self, fake2, mongo, pg, snapshot):
        group = await fake2.groups.create()

        user = await fake2.users.create(groups=[group], primary_group=group)

        document = await mongo.users.find_one({"_id": user.id})

        assert await apply_transforms(
            base_processor(document),
            [AttachGroupsTransform(mongo, pg)],
        ) == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_multiple_documents(self, fake2, mongo, pg, snapshot):
        group_1 = await fake2.groups.create()
        group_2 = await fake2.groups.create()

        await fake2.users.create(groups=[group_1, group_2], primary_group=group_1)
        await fake2.users.create(groups=[group_2], primary_group=group_2)

        assert await apply_transforms(
            [base_processor(document) async for document in mongo.users.find({})],
            [AttachPrimaryGroupTransform(mongo, pg)],
        ) == snapshot(
            matcher=path_type(
                {".*last_password_change": (datetime,), ".*password": (bytes,)},
                regex=True,
            )
        )


class TestAttachGroups:
    async def test_no_groups(self, fake2, mongo, pg, snapshot):
        """
        Test that the groups list is empty when a user is not a member of any groups.
        """
        user = await fake2.users.create()

        document = await mongo.users.find_one({"_id": user.id})

        assert await apply_transforms(
            base_processor(document), [AttachGroupsTransform(mongo, pg)]
        ) == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_single_document(self, fake2, mongo, pg, snapshot):
        group_1 = await fake2.groups.create()
        group_2 = await fake2.groups.create()
        group_3 = await fake2.groups.create()

        user = await fake2.users.create(
            groups=[
                group_1,
                group_2,
                group_3,
            ]
        )

        document = await mongo.users.find_one({"_id": user.id})

        assert await apply_transforms(
            base_processor(document), [AttachGroupsTransform(mongo, pg)]
        ) == snapshot(
            matcher=path_type(
                {"last_password_change": (datetime,), "password": (bytes,)}
            )
        )

    async def test_multiple_documents(self, fake2, mongo, pg, snapshot):
        user_1 = await fake2.users.create(
            groups=[
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
            ]
        )

        user_2 = await fake2.users.create(
            groups=[
                await fake2.groups.create(),
                await fake2.groups.create(),
                await fake2.groups.create(),
            ]
        )

        documents = [
            await mongo.users.find_one({"_id": user_1.id}),
            await mongo.users.find_one({"_id": user_2.id}),
        ]

        assert await apply_transforms(
            [base_processor(document) for document in documents],
            [AttachGroupsTransform(mongo, pg)],
        ) == snapshot(
            matcher=path_type(
                {".*last_password_change": (datetime,), ".*password": (bytes,)},
                regex=True,
            )
        )
