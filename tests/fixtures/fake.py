import shutil
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.http import HTTPClient
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.fake.wrapper import FakerWrapper
from virtool.mongo.core import Mongo
from virtool.redis import Redis


@pytest.fixture()
def app(mongo, pg, tmp_path, config, data_layer):
    return {
        "config": config,
        "data": data_layer,
        "fake": FakerWrapper(),
        "mongo": mongo,
        "pg": pg,
    }


@pytest.fixture()
def fake(
    data_layer: "DataLayer",
    example_path: Path,
    mocker,
    mongo: Mongo,
    pg: AsyncEngine,
    redis: Redis,
):
    """Provides a :class:`DataFaker` object for generating deterministic fake data.

    This fixture supersedes :fixture:`fake` and should be used in all new tests.

    .. code-block:: python

        async def test_example(data_layer: DataLayer, fake: DataFaker):
            # Create a fake job.
            job = await fake2.jobs.create()


            assert await data_layer.jobs.get(job.id) == job
    """
    # Use a local example ML model instead of downloading from GitHub.
    mocker.patch.object(
        HTTPClient,
        "download",
        side_effect=lambda url, target: shutil.copy(
            example_path / "ml/model.tar.gz",
            target,
        ),
    )

    return DataFaker(data_layer, mongo, pg, redis)
