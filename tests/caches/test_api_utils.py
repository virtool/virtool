import pytest

from virtool.api.errors import APIRequestEntityTooLarge
from virtool.caches.api_utils import CACHE_MAX_SIZE, read_cache_content_length


class TestReadCacheContentLength:
    def test_rejects_values_over_postgres_bigint(self, mocker):
        req = mocker.Mock(content_length=CACHE_MAX_SIZE + 1)

        with pytest.raises(
            APIRequestEntityTooLarge,
            match=f"Cache payload exceeds maximum size of {CACHE_MAX_SIZE} bytes",
        ):
            read_cache_content_length(req)
