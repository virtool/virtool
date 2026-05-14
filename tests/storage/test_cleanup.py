import pytest

from virtool.storage.cleanup import delete_prefix
from virtool.storage.errors import StorageError
from virtool.storage.memory import MemoryStorageProvider


async def _async_iter(data: bytes):
    yield data


@pytest.fixture
async def provider():
    provider = MemoryStorageProvider()

    for key in (
        "samples/abc/reads_1.fq.gz",
        "samples/abc/reads_2.fq.gz",
        "samples/other/reads_1.fq.gz",
    ):
        await provider.write(key, _async_iter(b"data"))

    return provider


async def test_deletes_all_keys_under_prefix(provider):
    failures = await delete_prefix(provider, "samples/abc/")

    assert failures == []
    assert [info.key async for info in provider.list("samples/")] == [
        "samples/other/reads_1.fq.gz",
    ]


async def test_empty_prefix_returns_no_failures(provider):
    assert await delete_prefix(provider, "samples/nothing/") == []


async def test_returns_failures_and_deletes_siblings(provider, mocker):
    real_delete = provider.delete

    async def fake_delete(key: str) -> None:
        if key == "samples/abc/reads_1.fq.gz":
            raise StorageError("S3 5xx")
        await real_delete(key)

    mocker.patch.object(provider, "delete", side_effect=fake_delete)

    failures = await delete_prefix(provider, "samples/abc/")

    assert len(failures) == 1
    failed_key, failed_exc = failures[0]
    assert failed_key == "samples/abc/reads_1.fq.gz"
    assert isinstance(failed_exc, StorageError)

    remaining = sorted([info.key async for info in provider.list("samples/")])
    assert remaining == [
        "samples/abc/reads_1.fq.gz",
        "samples/other/reads_1.fq.gz",
    ]
