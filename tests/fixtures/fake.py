import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.fake.wrapper import FakerWrapper
from virtool.identifier import AbstractIdProvider
from virtool.storage.protocol import StorageBackend


@pytest.fixture
def app(config, data_layer: DataLayer, pg: AsyncEngine):
    return {
        "config": config,
        "data": data_layer,
        "fake": FakerWrapper(),
        "pg": pg,
    }


@pytest.fixture
def fake(
    data_layer: DataLayer,
    id_provider: AbstractIdProvider,
    pg: AsyncEngine,
    memory_storage: StorageBackend,
):
    """Provides a :class:`DataFaker` object for generating deterministic fake data.

    .. code-block:: python

        async def test_example(data_layer: DataLayer, fake: DataFaker):
            # Create a fake job.
            job = await fake.jobs.create()


            assert await data_layer.jobs.get(job.id) == job
    """
    return DataFaker(data_layer, pg, memory_storage, id_provider)
