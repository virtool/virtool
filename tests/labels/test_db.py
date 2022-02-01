import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.db.transforms import apply_transforms
from virtool.labels.db import AttachLabelsTransform, SampleCountTransform
from virtool.labels.models import Label


@pytest.mark.parametrize(
    "documents",
    [
        {"id": "foo", "name": "Foo", "labels": [1, 2]},
        [
            {"id": "foo", "name": "Foo", "labels": [2]},
            {"id": "bar", "name": "Bar", "labels": [1, 2]},
            {"id": "baz", "name": "Baz", "labels": []},
        ],
    ],
)
async def test_label_attacher(documents, snapshot, pg: AsyncEngine):
    async with AsyncSession(pg) as session:
        session.add_all(
            [
                Label(id=1, name="Bug", color="#a83432", description="This is a bug"),
                Label(
                    id=2,
                    name="Question",
                    color="#03fc20",
                    description="This is a question",
                ),
            ]
        )
        await session.commit()

    assert await apply_transforms(documents, [AttachLabelsTransform(pg)]) == snapshot


@pytest.mark.parametrize(
    "labels",
    [
        {
            "id": 1,
            "name": "Bug",
            "color": "#a83432",
            "description": "This is a bug",
        },
        [
            {
                "id": 2,
                "name": "Question",
                "color": "#03fc20",
                "description": "This is a question",
            },
            {
                "id": 3,
                "name": "Info",
                "color": "#02db21",
                "description": "This is a info",
            },
        ],
    ],
)
async def test_sample_count_attacher(labels, snapshot, spawn_client):
    client = await spawn_client(authorize=True)

    await client.db.samples.insert_many(
        [
            {"_id": "foo", "name": "Foo", "labels": [1, 2, 4]},
            {"_id": "bar", "name": "Bar", "labels": []},
            {"_id": "baz", "name": "Baz", "labels": [2]},
        ]
    )

    assert await apply_transforms(labels, [SampleCountTransform(client.db)]) == snapshot
