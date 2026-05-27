from tempfile import TemporaryDirectory

from virtool.caches.tasks import LRUCacheEvictionTask
from virtool.data.layer import DataLayer


async def test_evict_delegates_to_data_layer(
    data_layer: DataLayer,
    mocker,
    static_time,
):
    evict_lru = mocker.patch.object(data_layer.caches, "evict_lru")
    temp_dir = TemporaryDirectory()

    try:
        await LRUCacheEvictionTask(0, data_layer, {}, temp_dir).evict()
    finally:
        temp_dir.cleanup()

    evict_lru.assert_awaited_once_with(static_time.datetime)
