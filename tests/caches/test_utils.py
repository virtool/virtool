import hashlib

import pytest

from virtool.api.custom_json import dump_string
from virtool.api.errors import APIBadRequest, APIRequestEntityTooLarge
from virtool.caches.utils import (
    CACHE_MAX_SIZE,
    cache_body_chunker,
    canonicalize_params,
    derive_key,
    read_cache_content_length,
    read_cache_params,
)


class TestCanonicalizeParams:
    def test_sorts_keys(self):
        assert (
            canonicalize_params({"z_field": 1, "a_field": 2})
            == '{"a_field":2,"z_field":1}'
        )

    def test_tight_separators(self):
        assert " " not in canonicalize_params({"z_field": 1, "a_field": 2})

    def test_escapes_non_ascii(self):
        assert canonicalize_params({"label": "café"}) == '{"label":"caf\\u00e9"}'

    def test_nested_keys_sorted(self):
        assert (
            canonicalize_params({"extra": {"b": 1, "a": 2}})
            == '{"extra":{"a":2,"b":1}}'
        )


class TestDeriveKey:
    def test_returns_sha256_hex(self):
        key = derive_key({"z_field": 1, "a_field": 2})
        assert len(key) == 64
        assert int(key, 16) >= 0

    def test_field_value_changes_key(self):
        assert derive_key({"z_field": 1, "a_field": 2}) != derive_key(
            {"z_field": 1, "a_field": 3},
        )

    def test_different_shape_changes_key(self):
        """Dicts with different schemas produce different keys."""
        assert derive_key({"name": "skewer", "version": "0.2.2"}) != derive_key(
            {"z_field": 1, "a_field": 2},
        )

    def test_matches_manual_sha256(self):
        """Pin the payload: SHA-256 of the canonical params JSON dump."""
        expected = hashlib.sha256(b'{"a_field":2,"z_field":1}').hexdigest()

        actual = derive_key({"z_field": 1, "a_field": 2})
        assert actual == expected


class TestReadCacheParams:
    def test_returns_none_when_params_missing(self, mocker):
        req = mocker.Mock(query={})

        assert read_cache_params(req) is None

    def test_returns_valid_params(self, mocker):
        params = {"sample_id": "sample", "workflow": "nuvs"}
        req = mocker.Mock(query={"params": dump_string(params)})

        assert read_cache_params(req) == params

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
    def test_rejects_missing_content_length(self, mocker):
        req = mocker.Mock(content_length=None)

        with pytest.raises(
            APIBadRequest,
            match="Content-Length header is required",
        ):
            read_cache_content_length(req)

    def test_rejects_values_over_cache_max_size(self, mocker):
        req = mocker.Mock(content_length=CACHE_MAX_SIZE + 1)

        with pytest.raises(
            APIRequestEntityTooLarge,
            match=f"Cache payload exceeds maximum size of {CACHE_MAX_SIZE} bytes",
        ):
            read_cache_content_length(req)


class TestCacheBodyChunker:
    async def test_yields_body_with_matching_content_length(self, mocker):
        req = mocker.Mock()
        req.content.read = mocker.AsyncMock(side_effect=[b"cached", b""])

        chunks = [chunk async for chunk in cache_body_chunker(req, 6)]

        assert chunks == [b"cached"]

    async def test_rejects_body_larger_than_content_length(self, mocker):
        req = mocker.Mock()
        req.content.read = mocker.AsyncMock(side_effect=[b"cached", b""])

        chunker = cache_body_chunker(req, 5)

        with pytest.raises(
            APIBadRequest,
            match="Request body size exceeds Content-Length",
        ):
            await anext(chunker)

    async def test_rejects_body_within_content_length_but_over_cache_max_size(
        self,
        mocker,
        monkeypatch,
    ):
        monkeypatch.setattr("virtool.caches.utils.CACHE_MAX_SIZE", 5)
        req = mocker.Mock()
        req.content.read = mocker.AsyncMock(side_effect=[b"cached", b""])

        chunker = cache_body_chunker(req, 6)

        with pytest.raises(
            APIRequestEntityTooLarge,
            match="Cache payload exceeds maximum size of 5 bytes",
        ):
            await anext(chunker)
