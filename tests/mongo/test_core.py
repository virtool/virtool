from datetime import UTC, datetime, timedelta, timezone

import pytest

from virtool.mongo.core import Mongo


class TestEnforceNaiveUTC:
    """The Mongo write boundary enforces the naive-UTC datetime invariant."""

    async def test_insert_one_strips_aware_utc(self, mongo: Mongo):
        await mongo.samples.insert_one(
            {"_id": "sample", "created_at": datetime(2020, 1, 1, 12, tzinfo=UTC)},
        )

        document = await mongo.samples.find_one({"_id": "sample"})

        assert document["created_at"] == datetime(2020, 1, 1, 12)
        assert document["created_at"].tzinfo is None

    async def test_insert_one_rejects_aware_non_utc(self, mongo: Mongo):
        with pytest.raises(ValueError, match="aware non-UTC datetime"):
            await mongo.samples.insert_one(
                {
                    "_id": "sample",
                    "created_at": datetime(
                        2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=-5))
                    ),
                },
            )

    async def test_update_one_strips_nested_aware_utc(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        await mongo.samples.update_one(
            {"_id": "sample"},
            {"$set": {"updated_at": datetime(2020, 1, 1, 12, tzinfo=UTC)}},
        )

        document = await mongo.samples.find_one({"_id": "sample"})

        assert document["updated_at"] == datetime(2020, 1, 1, 12)

    async def test_update_one_rejects_aware_non_utc(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        with pytest.raises(ValueError, match="aware non-UTC datetime"):
            await mongo.samples.update_one(
                {"_id": "sample"},
                {
                    "$set": {
                        "updated_at": datetime(
                            2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=2))
                        ),
                    },
                },
            )

    async def test_update_many_strips_aware_utc(self, mongo: Mongo):
        await mongo.samples.insert_many(
            [{"_id": "one"}, {"_id": "two"}],
            session=None,
        )

        await mongo.samples.update_many(
            {},
            {"$set": {"updated_at": datetime(2020, 1, 1, 12, tzinfo=UTC)}},
        )

        async for document in mongo.samples.find({}):
            assert document["updated_at"] == datetime(2020, 1, 1, 12)

    async def test_update_many_rejects_aware_non_utc(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        with pytest.raises(ValueError, match="aware non-UTC datetime"):
            await mongo.samples.update_many(
                {},
                {
                    "$set": {
                        "updated_at": datetime(
                            2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=2))
                        ),
                    },
                },
            )

    async def test_replace_one_strips_aware_utc(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        await mongo.samples.replace_one(
            {"_id": "sample"},
            {"_id": "sample", "created_at": datetime(2020, 1, 1, 12, tzinfo=UTC)},
        )

        document = await mongo.samples.find_one({"_id": "sample"})

        assert document["created_at"] == datetime(2020, 1, 1, 12)

    async def test_replace_one_rejects_aware_non_utc(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        with pytest.raises(ValueError, match="aware non-UTC datetime"):
            await mongo.samples.replace_one(
                {"_id": "sample"},
                {
                    "_id": "sample",
                    "created_at": datetime(
                        2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=-3))
                    ),
                },
            )

    async def test_find_one_and_update_strips_aware_utc(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        document = await mongo.samples.find_one_and_update(
            {"_id": "sample"},
            {"$set": {"updated_at": datetime(2020, 1, 1, 12, tzinfo=UTC)}},
        )

        assert document["updated_at"] == datetime(2020, 1, 1, 12)

    async def test_find_one_and_update_rejects_aware_non_utc(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        with pytest.raises(ValueError, match="aware non-UTC datetime"):
            await mongo.samples.find_one_and_update(
                {"_id": "sample"},
                {
                    "$set": {
                        "updated_at": datetime(
                            2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=2))
                        ),
                    },
                },
            )

    async def test_insert_many_strips_aware_utc(self, mongo: Mongo):
        await mongo.samples.insert_many(
            [
                {"_id": "one", "created_at": datetime(2020, 1, 1, 12, tzinfo=UTC)},
                {"_id": "two", "created_at": datetime(2020, 1, 2, 12, tzinfo=UTC)},
            ],
            session=None,
        )

        one = await mongo.samples.find_one({"_id": "one"})
        two = await mongo.samples.find_one({"_id": "two"})

        assert one["created_at"] == datetime(2020, 1, 1, 12)
        assert two["created_at"] == datetime(2020, 1, 2, 12)

    async def test_insert_many_rejects_aware_non_utc(self, mongo: Mongo):
        with pytest.raises(ValueError, match="aware non-UTC datetime"):
            await mongo.samples.insert_many(
                [
                    {
                        "_id": "one",
                        "created_at": datetime(
                            2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=2))
                        ),
                    },
                ],
                session=None,
            )

    async def test_strips_datetime_nested_in_tuple(self, mongo: Mongo):
        await mongo.samples.insert_one(
            {
                "_id": "sample",
                "events": ({"at": datetime(2020, 1, 1, 12, tzinfo=UTC)},),
            },
        )

        document = await mongo.samples.find_one({"_id": "sample"})

        assert document["events"][0]["at"] == datetime(2020, 1, 1, 12)
