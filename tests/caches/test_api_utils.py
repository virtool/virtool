import pytest

from virtool.api.errors import APIBadRequest, APIRequestEntityTooLarge
from virtool.caches.api_utils import (
    CACHE_MAX_SIZE,
    cache_body_chunker,
    read_cache_content_length,
    read_cache_params,
)


class TestReadCacheParams:
    def test_rejects_invalid_json(self, mocker):
        req = mocker.Mock(query={"params": "{"})

        with pytest.raises(
            APIBadRequest,
            match="Invalid JSON in 'params' query parameter",
        ):
            read_cache_params(req)

    def test_rejects_non_object_json(self, mocker):
        req = mocker.Mock(query={"params": "[]"})

        with pytest.raises(
            APIBadRequest,
            match="Query parameter 'params' must be a JSON object",
        ):
            read_cache_params(req)


class TestReadCacheContentLength:
    def test_rejects_values_over_cache_max_size(self, mocker):
        req = mocker.Mock(content_length=CACHE_MAX_SIZE + 1)

        with pytest.raises(
            APIRequestEntityTooLarge,
            match=f"Cache payload exceeds maximum size of {CACHE_MAX_SIZE} bytes",
        ):
            read_cache_content_length(req)


class TestCacheBodyChunker:
    async def test_rejects_body_larger_than_content_length(self, mocker):
        req = mocker.Mock()
        req.content.read = mocker.AsyncMock(side_effect=[b"cached", b""])

        chunker = cache_body_chunker(req, 5)

        with pytest.raises(
            APIBadRequest,
            match="Request body size exceeds Content-Length",
        ):
            await anext(chunker)
