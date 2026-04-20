from pathlib import Path

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.http import HTTPClient
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.fake.wrapper import FakerWrapper
from virtool.mongo.core import Mongo


@pytest.fixture
def app(config, data_layer: DataLayer, mongo: Mongo, pg: AsyncEngine):
    return {
        "config": config,
        "data": data_layer,
        "fake": FakerWrapper(),
        "mongo": mongo,
        "pg": pg,
    }


@pytest.fixture
def fake(
    data_layer: DataLayer,
    example_path: Path,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
):
    """Provides a :class:`DataFaker` object for generating deterministic fake data.

    This fixture supersedes :fixture:`fake` and should be used in all new workflow.

    .. code-block:: python

        async def test_example(data_layer: DataLayer, fake: DataFaker):
            # Create a fake job.
            job = await fake2.jobs.create()


            assert await data_layer.jobs.get(job.id) == job
    """
    model_bytes = (example_path / "ml/model.tar.gz").read_bytes()

    async def fake_stream(url):
        yield model_bytes

    mocker.patch.object(HTTPClient, "stream", side_effect=fake_stream)

    return DataFaker(data_layer, mongo, pg)
