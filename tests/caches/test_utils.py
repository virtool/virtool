import hashlib

from virtool.caches.types import BaseCacheParams
from virtool.caches.utils import canonicalize_params, derive_key


class SortFieldParams(BaseCacheParams):
    """Subclass with non-alphabetical field declaration order."""

    z_field: int = 0
    a_field: int = 0


class NestedMappingParams(BaseCacheParams):
    """Subclass holding a nested mapping to exercise recursive key sorting."""

    extra: dict[str, int] = {}


class SingleStringParams(BaseCacheParams):
    """Subclass with a single string field for escape-behavior tests."""

    label: str = ""


class TwoFieldParams(BaseCacheParams):
    """Subclass with two scalar fields for differentiation tests."""

    name: str = ""
    version: str = ""


class TestCanonicalizeParams:
    def test_sorts_keys(self):
        params = SortFieldParams(z_field=1, a_field=2)
        assert canonicalize_params(params) == '{"a_field":2,"z_field":1}'

    def test_tight_separators(self):
        params = SortFieldParams(z_field=1, a_field=2)
        assert " " not in canonicalize_params(params)

    def test_escapes_non_ascii(self):
        params = SingleStringParams(label="café")
        assert canonicalize_params(params) == '{"label":"caf\\u00e9"}'

    def test_nested_keys_sorted(self):
        params = NestedMappingParams(extra={"b": 1, "a": 2})
        assert canonicalize_params(params) == '{"extra":{"a":2,"b":1}}'


class TestDeriveKey:
    def test_returns_sha256_hex(self):
        key = derive_key(SortFieldParams(z_field=1, a_field=2))
        assert len(key) == 64
        assert int(key, 16) >= 0

    def test_field_value_changes_key(self):
        assert derive_key(SortFieldParams(z_field=1, a_field=2)) != derive_key(
            SortFieldParams(z_field=1, a_field=3),
        )

    def test_subclass_shape_changes_key(self):
        """Different subclasses with different schemas produce different keys."""
        assert derive_key(
            TwoFieldParams(name="skewer", version="0.2.2"),
        ) != derive_key(
            SortFieldParams(z_field=1, a_field=2),
        )

    def test_matches_manual_sha256(self):
        """Pin the payload: SHA-256 of the canonical params JSON dump."""
        expected = hashlib.sha256(
            b'{"a_field":2,"z_field":1}',
        ).hexdigest()

        actual = derive_key(SortFieldParams(z_field=1, a_field=2))
        assert actual == expected
