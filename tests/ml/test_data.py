import datetime
from pathlib import Path
from unittest.mock import call

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.assertion import SnapshotAssertion
from syrupy.matchers import path_type

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.ml.tasks import MLModelsSyncTask
from virtool.tasks.sql import SQLTask


@pytest.mark.parametrize("has_last_checked_at", [True, False])
async def test_list(
    has_last_checked_at: bool,
    data_layer: DataLayer,
    fake: DataFaker,
    pg: AsyncEngine,
    snapshot_recent: SnapshotAssertion,
    static_time,
):
    """Test that MLData.list() returns a list of MLModel objects.

    This test also indirectly workflow that MLData.load() can be used by the data faker
    to populate the database with ML models and releases.
    """
    await fake.ml.populate()

    if has_last_checked_at:
        async with AsyncSession(pg) as session:
            session.add(
                SQLTask(
                    complete=True,
                    created_at=static_time.datetime,
                    progress=100,
                    step="sync",
                    type=MLModelsSyncTask.name,
                ),
            )
            await session.commit()

    assert await data_layer.ml.list() == snapshot_recent


async def test_get(
    data_layer: DataLayer,
    fake: DataFaker,
    snapshot_recent: SnapshotAssertion,
):
    """Test that MLData.get() returns a complete representation of an ML model."""
    await fake.ml.populate()

    assert await data_layer.ml.get(1) == snapshot_recent(
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )


async def test_load(
    data_layer: DataLayer,
    example_path: Path,
    fake: DataFaker,
    mocker: MockerFixture,
    snapshot_recent: SnapshotAssertion,
):
    """Test that MLData.load() can load updated models into the database."""
    model_bytes = (example_path / "ml/model.tar.gz").read_bytes()

    async def fake_stream(url):
        yield model_bytes

    mocker.patch.object(data_layer.ml._http, "stream", fake_stream)
    spy = mocker.spy(data_layer.ml._http, "stream")

    first = [fake.ml.create_release_manifest_item() for _ in range(3)]

    await data_layer.ml.load({"ml-plant-viruses": first})

    assert await data_layer.ml.list() == snapshot_recent(
        name="first",
    )

    await data_layer.ml.load(
        {
            "ml-plant-viruses": [
                *first,
                *[fake.ml.create_release_manifest_item() for _ in range(2)],
            ],
            "ml-insect-viruses": [fake.ml.create_release_manifest_item()],
        },
    )

    assert await data_layer.ml.list() == snapshot_recent(
        name="second",
    )

    assert await data_layer.ml.get(1) == snapshot_recent(
        name="ml-plant-viruses",
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )

    assert await data_layer.ml.get(2) == snapshot_recent(
        name="ml-insect-viruses",
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )

    spy.assert_has_calls(
        [
            call("https://www.snyder.com/"),
            call("http://acosta.com/"),
            call("http://www.love.net/"),
            call("https://butler.com/"),
        ],
        any_order=True,
    )

    expected_keys = {f"ml/{i}/model.tar.gz" for i in [1, 2, 3, 9]}
    actual_keys = {info.key async for info in data_layer.ml._storage.list("ml/")}
    assert actual_keys >= expected_keys
