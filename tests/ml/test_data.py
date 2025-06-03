import datetime
import shutil
from pathlib import Path
from unittest.mock import call

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.ml.tasks import SyncMLModelsTask
from virtool.tasks.models import SQLTask


@pytest.mark.parametrize("has_last_checked_at", [True, False])
async def test_list(
    has_last_checked_at: bool,
    data_layer: DataLayer,
    fake: DataFaker,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    """Test that MLData.list() returns a list of MLModel objects.

    This test also indirectly tests that MLData.load() can be used by the data faker
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
                    type=SyncMLModelsTask.name,
                ),
            )
            await session.commit()

    assert await data_layer.ml.list() == snapshot(
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )


async def test_get(
    data_layer: DataLayer,
    fake: DataFaker,
    snapshot,
):
    """Test that MLData.get() returns a complete representation of an ML model."""
    await fake.ml.populate()

    assert await data_layer.ml.get(1) == snapshot(
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )


async def test_load(
    data_path: Path,
    data_layer: DataLayer,
    example_path,
    fake: DataFaker,
    mocker: MockerFixture,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    """Test that MLData.load() can load updated models into the database."""

    async def download_func(url, target, _=None):
        shutil.copy(example_path / "ml/model.tar.gz", target)

    mocker.patch.object(
        data_layer.ml._http,
        "download",
        download_func,
    )

    spy = mocker.spy(data_layer.ml._http, "download")

    first = [fake.ml.create_release_manifest_item() for _ in range(3)]

    await data_layer.ml.load({"ml-plant-viruses": first})

    assert await data_layer.ml.list() == snapshot(
        name="first",
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
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

    assert await data_layer.ml.list() == snapshot(
        name="second",
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )

    assert await data_layer.ml.get(1) == snapshot(
        name="ml-plant-viruses",
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )

    assert await data_layer.ml.get(2) == snapshot(
        name="ml-insect-viruses",
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )

    spy.assert_has_calls(
        [
            call("https://www.snyder.com/", data_path / "ml/1/model.tar.gz"),
            call("http://walker.com/", data_path / "ml/2/model.tar.gz"),
            call("http://www.morales.biz/", data_path / "ml/3/model.tar.gz"),
            call("http://johnson.com/", data_path / "ml/9/model.tar.gz"),
        ],
        any_order=True,
    )
