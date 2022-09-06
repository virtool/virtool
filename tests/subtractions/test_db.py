import pytest

import virtool.subtractions.db
from virtool.mongo.transforms import apply_transforms
from virtool.subtractions.db import (
    AttachSubtractionTransform,
    unlink_default_subtractions,
)


@pytest.mark.parametrize(
    "documents",
    [
        {"id": "sub_1", "subtractions": ["foo", "bar"]},
        [
            {"id": "sub_1", "subtractions": ["foo", "bar"]},
            {"id": "sub_2", "subtractions": ["foo"]},
            {"id": "sub_3", "subtractions": []},
        ],
    ],
)
async def test_attach_subtractions(documents, dbi, snapshot):
    await dbi.subtraction.insert_many(
        [{"_id": "foo", "name": "Foo"}, {"_id": "bar", "name": "Bar"}]
    )

    result = await apply_transforms(documents, [AttachSubtractionTransform(dbi)])

    assert result == snapshot


async def test_get_linked_samples(dbi):
    await dbi.samples.insert_many(
        [
            {"_id": "foo", "name": "Foo", "subtractions": ["1", "5", "3"]},
            {"_id": "bar", "name": "Bar", "subtractions": ["2", "5", "8"]},
            {"_id": "baz", "name": "Baz", "subtractions": ["2"]},
        ]
    )

    samples = await virtool.subtractions.db.get_linked_samples(dbi, "5")

    assert samples == [{"id": "foo", "name": "Foo"}, {"id": "bar", "name": "Bar"}]


async def test_unlink_default_subtractions(dbi):
    await dbi.samples.insert_many(
        [
            {"_id": "foo", "subtractions": ["1", "2", "3"]},
            {"_id": "bar", "subtractions": ["2", "5", "8"]},
            {"_id": "baz", "subtractions": ["2"]},
        ]
    )

    async with dbi.create_session() as session:
        await unlink_default_subtractions(dbi, "2", session)

    assert await dbi.samples.find().to_list(None) == [
        {"_id": "foo", "subtractions": ["1", "3"]},
        {"_id": "bar", "subtractions": ["5", "8"]},
        {"_id": "baz", "subtractions": []},
    ]
