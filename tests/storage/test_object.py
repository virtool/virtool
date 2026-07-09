"""Unit tests for ``ObjectProvider``.

Drives the provider through its public surface, backed by an obstore in-memory
store via :meth:`ObjectProvider.for_memory`. End-to-end coverage against real
S3 / Azure backends lives in ``test_integration.py``; the protocol-level
behavioural contract is exercised in ``test_memory.py`` and the integration
suite. These tests focus on translation between obstore and the
``StorageBackend`` protocol that ``ObjectProvider`` is responsible for.
"""

import pytest
from obstore.exceptions import GenericError

from virtool.storage.errors import StorageError, StorageKeyNotFoundError
from virtool.storage.object import ObjectProvider


@pytest.fixture
def provider() -> ObjectProvider:
    return ObjectProvider.for_memory()


async def _async_iter(data: bytes, chunk_size: int = 1024):
    for i in range(0, len(data), chunk_size):
        yield data[i : i + chunk_size]


async def _collect_bytes(aiter) -> bytes:
    return b"".join([chunk async for chunk in aiter])


class TestErrorTranslation:
    async def test_read_missing_key_raises_storage_error(self, provider):
        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(provider.read("does/not/exist"))

    async def test_delete_missing_key_is_idempotent(self, provider):
        await provider.delete("does/not/exist")

    async def test_delete_swallows_s3_compatible_no_such_key(self, provider, mocker):
        """Garage-style backends wrap not-found as GenericError carrying a
        structured ``code: "NoSuchKey"`` marker; verify the provider treats it
        as idempotent.
        """
        mocker.patch(
            "virtool.storage.object.obs.delete_async",
            side_effect=GenericError(
                "Generic S3 error: DeleteObjects request failed for key foo: "
                "Key not found (code: NoSuchKey)\n\n"
                "Debug source:\n"
                "Generic {\n"
                '    store: "S3",\n'
                "    source: DeleteFailed {\n"
                '        path: "foo",\n'
                '        code: "NoSuchKey",\n'
                '        message: "Key not found",\n'
                "    },\n"
                "}",
            ),
        )

        await provider.delete("missing")

    async def test_delete_does_not_swallow_prose_mention_of_no_such_key(
        self,
        provider,
        mocker,
    ):
        """A GenericError that merely mentions NoSuchKey in prose (audit
        traces, wrapped error chains) without a structured ``code:`` field
        must surface as StorageError.
        """
        mocker.patch(
            "virtool.storage.object.obs.delete_async",
            side_effect=GenericError(
                "Generic S3 error: throttled (status 503). Prior request "
                "context: GET NoSuchKey lookup",
            ),
        )

        with pytest.raises(StorageError):
            await provider.delete("present")

    async def test_delete_does_not_swallow_unrelated_error_code(
        self,
        provider,
        mocker,
    ):
        """A structured S3 error code other than NoSuchKey (e.g. NoSuchBucket)
        must not be treated as a missing object.
        """
        mocker.patch(
            "virtool.storage.object.obs.delete_async",
            side_effect=GenericError(
                "Generic S3 error: bucket missing (code: NoSuchBucket)\n\n"
                "Debug source:\n"
                'Generic { source: BucketMissing { code: "NoSuchBucket" } }',
            ),
        )

        with pytest.raises(StorageError):
            await provider.delete("present")

    async def test_copy_missing_source_raises_key_not_found(self, provider):
        with pytest.raises(StorageKeyNotFoundError):
            await provider.copy("does/not/exist", "dst")

    async def test_copy_translates_s3_compatible_no_such_key(self, provider, mocker):
        """Unlike ``delete``, a missing source is an error for ``copy``.

        Garage-style backends wrap not-found as a GenericError carrying a
        structured ``code: "NoSuchKey"`` marker, which must surface as
        StorageKeyNotFoundError rather than a bare StorageError.
        """
        mocker.patch(
            "virtool.storage.object.obs.copy_async",
            side_effect=GenericError(
                "Generic S3 error: CopyObject request failed for key foo: "
                "Key not found (code: NoSuchKey)",
            ),
        )

        with pytest.raises(StorageKeyNotFoundError):
            await provider.copy("missing", "dst")

    async def test_copy_does_not_swallow_unrelated_error_code(self, provider, mocker):
        mocker.patch(
            "virtool.storage.object.obs.copy_async",
            side_effect=GenericError(
                "Generic S3 error: bucket missing (code: NoSuchBucket)",
            ),
        )

        with pytest.raises(StorageError) as info:
            await provider.copy("present", "dst")

        assert not isinstance(info.value, StorageKeyNotFoundError)


class TestCopy:
    async def test_ok(self, provider):
        await provider.write("samples/abc/reads.fq.gz", _async_iter(b"read data"))

        await provider.copy("samples/abc/reads.fq.gz", "samples/12/reads.fq.gz")

        assert (
            await _collect_bytes(provider.read("samples/12/reads.fq.gz"))
            == b"read data"
        )
        assert (
            await _collect_bytes(provider.read("samples/abc/reads.fq.gz"))
            == b"read data"
        )

    async def test_overwrites_destination(self, provider):
        await provider.write("src", _async_iter(b"new"))
        await provider.write("dst", _async_iter(b"stale"))

        await provider.copy("src", "dst")

        assert await _collect_bytes(provider.read("dst")) == b"new"


class TestSize:
    async def test_ok(self, provider):
        await provider.write("samples/abc/reads.fq.gz", _async_iter(b"hello world"))

        assert await provider.size("samples/abc/reads.fq.gz") == 11

    async def test_empty_object(self, provider):
        await provider.write("empty", _async_iter(b""))

        assert await provider.size("empty") == 0

    async def test_nonexistent_key(self, provider):
        with pytest.raises(StorageKeyNotFoundError):
            await provider.size("does/not/exist")


class TestRoundtrip:
    async def test_write_then_read(self, provider):
        await provider.write("samples/abc/reads.fq.gz", _async_iter(b"hello"))

        assert (
            await _collect_bytes(provider.read("samples/abc/reads.fq.gz")) == b"hello"
        )

    async def test_write_returns_byte_count(self, provider):
        size = await provider.write("uploads/file.txt", _async_iter(b"x" * 5000))

        assert size == 5000

    async def test_overwrite(self, provider):
        await provider.write("key", _async_iter(b"first"))
        await provider.write("key", _async_iter(b"second"))

        assert await _collect_bytes(provider.read("key")) == b"second"

    async def test_delete_then_read_raises(self, provider):
        await provider.write("doomed", _async_iter(b"data"))
        await provider.delete("doomed")

        with pytest.raises(StorageKeyNotFoundError):
            await _collect_bytes(provider.read("doomed"))


class TestAllowHttpGating:
    """``allow_http`` must only be enabled for plaintext ``http://`` endpoints.

    Setting it unconditionally on any custom endpoint silently permits
    plaintext traffic to an operator-configured ``https://`` host.
    """

    def test_for_s3_allows_http_only_for_http_endpoint(self, mocker):
        s3_store = mocker.patch("obstore.store.S3Store")

        ObjectProvider.for_s3("bucket", endpoint="http://minio:9000")

        assert s3_store.call_args.kwargs["client_options"] == {"allow_http": True}

    def test_for_s3_omits_allow_http_for_https_endpoint(self, mocker):
        s3_store = mocker.patch("obstore.store.S3Store")

        ObjectProvider.for_s3("bucket", endpoint="https://s3.example.com")

        assert "client_options" not in s3_store.call_args.kwargs

    def test_for_s3_omits_allow_http_when_no_endpoint(self, mocker):
        s3_store = mocker.patch("obstore.store.S3Store")

        ObjectProvider.for_s3("bucket", region="us-east-1")

        assert "client_options" not in s3_store.call_args.kwargs

    def test_for_azure_allows_http_only_for_http_endpoint(self, mocker):
        azure_store = mocker.patch("obstore.store.AzureStore")

        ObjectProvider.for_azure(
            "container", account="dev", endpoint="http://azurite:10000"
        )

        assert azure_store.call_args.kwargs["client_options"] == {"allow_http": True}

    def test_for_azure_omits_allow_http_for_https_endpoint(self, mocker):
        azure_store = mocker.patch("obstore.store.AzureStore")

        ObjectProvider.for_azure(
            "container", account="prod", endpoint="https://prod.blob.core.windows.net"
        )

        assert "client_options" not in azure_store.call_args.kwargs
