import hashlib

from virtool.caches.utils import canonicalize_params, derive_key


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
