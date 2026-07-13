import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.fake.wrapper import FakerWrapper
from virtool.mongo.core import Mongo
from virtool.storage.protocol import StorageBackend


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
    mongo: Mongo,
    pg: AsyncEngine,
    memory_storage: StorageBackend,
):
    """Provides a :class:`DataFaker` object for generating deterministic fake data.

    This fixture supersedes :fixture:`fake` and should be used in all new workflow.

    .. code-block:: python

        async def test_example(data_layer: DataLayer, fake: DataFaker):
            # Create a fake job.
            job = await fake2.jobs.create()


            assert await data_layer.jobs.get(job.id) == job
    """
    return DataFaker(data_layer, mongo, pg, memory_storage)
