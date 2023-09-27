import datetime
import shutil
from pprint import pprint
from unittest.mock import call

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.matchers import path_type

from virtool.data.layer import DataLayer
from virtool.ml.tasks import SyncMLModelsTask
from virtool.tasks.models import SQLTask


@pytest.mark.parametrize("has_last_checked_at", [True, False])
async def test_list(
    has_last_checked_at: bool,
    data_layer: DataLayer,
    fake2,
    pg: AsyncEngine,
    snapshot,
    static_time,
):
    """
    Test that MLData.list() returns a list of MLModel objects.

    This test also indirectly tests that MLData.load() can be used by the data faker
    to populate the database with ML models and releases.
    """
    await fake2.ml.populate()

    if has_last_checked_at:
        async with AsyncSession(pg) as session:
            session.add(
                SQLTask(
                    complete=True,
                    created_at=static_time.datetime,
                    progress=100,
                    step="sync",
                    type=SyncMLModelsTask.name,
                )
            )
            await session.commit()

    assert await data_layer.ml.list() == snapshot(
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True)
    )


async def test_get(
    data_layer: DataLayer,
    fake2,
    pg: AsyncEngine,
    snapshot,
    static_time,
):
    """Test that MLData.get() returns a complete representation of an ML model."""
    await fake2.ml.populate()

    assert await data_layer.ml.get(1) == snapshot(
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True)
    )


async def test_load(
    config,
    data_layer: DataLayer,
    example_path,
    fake2,
    mocker,
    pg: AsyncEngine,
    snapshot,
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

    first = [fake2.ml.create_release_manifest_item() for _ in range(3)]

    await data_layer.ml.load({"ml-plant-viruses": first})

    assert await data_layer.ml.list() == snapshot(
        name="first",
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )

    await data_layer.ml.load(
        {
            "ml-plant-viruses": [
                *first,
                *[fake2.ml.create_release_manifest_item() for _ in range(2)],
            ],
            "ml-insect-viruses": [fake2.ml.create_release_manifest_item()],
        }
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

    pprint(spy.call_args_list)

    spy.assert_has_calls(
        [
            call("https://www.snyder.com/", config.data_path / "ml/1/model.tar.gz"),
            call("http://walker.com/", config.data_path / "ml/2/model.tar.gz"),
            call("http://www.morales.biz/", config.data_path / "ml/3/model.tar.gz"),
            call("http://johnson.com/", config.data_path / "ml/9/model.tar.gz"),
        ],
        any_order=True,
    )
