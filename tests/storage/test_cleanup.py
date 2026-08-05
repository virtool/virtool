import pytest

from virtool.storage.cleanup import delete_keys
from virtool.storage.errors import StorageError
from virtool.storage.memory import MemoryStorageProvider

SAMPLE_READS_1 = "samples/12/9f2c4a1b"
SAMPLE_READS_2 = "samples/12/3d7e8b5c"
OTHER_SAMPLE_READS = "samples/34/1a6f0d92"


async def _async_iter(data: bytes):
    yield data


@pytest.fixture
async def provider():
    provider = MemoryStorageProvider()

    for key in (SAMPLE_READS_1, SAMPLE_READS_2, OTHER_SAMPLE_READS):
        await provider.write(key, _async_iter(b"data"))

    return provider


async def test_deletes_every_named_key(provider):
    failures = await delete_keys(provider, [SAMPLE_READS_1, SAMPLE_READS_2])

    assert failures == []
    assert [info.key async for info in provider.list("samples/")] == [
        OTHER_SAMPLE_READS,
    ]


async def test_no_keys_returns_no_failures(provider):
    assert await delete_keys(provider, []) == []


async def test_unnamed_objects_are_left_alone(provider):
    """Only keys a row named are removed; anything else survives.

    Objects written before keys were recorded are not reachable through any row,
    so a resource delete must leave them for the orphan sweep rather than
    guessing at a prefix.
    """
    await provider.write("samples/12/legacy-untracked.txt", _async_iter(b"data"))

    assert await delete_keys(provider, [SAMPLE_READS_1, SAMPLE_READS_2]) == []

    assert sorted([info.key async for info in provider.list("samples/12/")]) == [
        "samples/12/legacy-untracked.txt",
    ]


async def test_returns_failures_and_deletes_siblings(provider, mocker):
    real_delete = provider.delete

    async def fake_delete(key: str) -> None:
        if key == SAMPLE_READS_1:
            raise StorageError("S3 5xx")
        await real_delete(key)

    mocker.patch.object(provider, "delete", side_effect=fake_delete)

    failures = await delete_keys(provider, [SAMPLE_READS_1, SAMPLE_READS_2])

    assert len(failures) == 1
    failed_key, failed_exc = failures[0]
    assert failed_key == SAMPLE_READS_1
    assert isinstance(failed_exc, StorageError)

    remaining = sorted([info.key async for info in provider.list("samples/")])
    assert remaining == [SAMPLE_READS_1, OTHER_SAMPLE_READS]
