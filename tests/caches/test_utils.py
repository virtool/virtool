import hashlib

import pytest

from virtool.caches.utils import canonicalize_params, derive_key, normalize_semver
from virtool.caches.types import CacheType


class TestCanonicalizeParams:
    def test_empty(self):
        assert canonicalize_params({}) == "{}"

    def test_sorts_keys(self):
        assert canonicalize_params({"b": 1, "a": 2}) == '{"a":2,"b":1}'

    def test_order_independent(self):
        assert canonicalize_params({"a": 1, "b": 2}) == canonicalize_params(
            {"b": 2, "a": 1},
        )

    def test_tight_separators(self):
        assert canonicalize_params({"a": [1, 2]}) == '{"a":[1,2]}'

    def test_escapes_non_ascii(self):
        # ensure_ascii=True so identical bytes regardless of locale
        assert canonicalize_params({"name": "café"}) == '{"name":"caf\\u00e9"}'

    def test_nested_keys_sorted(self):
        canonical = canonicalize_params({"outer": {"b": 1, "a": 2}})
        assert canonical == '{"outer":{"a":2,"b":1}}'


class TestNormalizeSemver:
    def test_passthrough(self):
        assert normalize_semver("1.2.3") == "1.2.3"

    def test_strips_v_prefix(self):
        assert normalize_semver("v1.2.3") == "1.2.3"

    def test_keeps_prerelease(self):
        assert normalize_semver("1.2.3-rc.1") == "1.2.3-rc.1"

    def test_strips_build_metadata(self):
        assert normalize_semver("1.2.3+build.7") == "1.2.3"

    def test_strips_build_keeps_prerelease(self):
        assert normalize_semver("1.2.3-rc.1+build.7") == "1.2.3-rc.1"

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            normalize_semver("not-a-version")


class TestDeriveKey:
    def test_returns_sha256_hex(self):
        key = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {"min_length": 50},
            "sample_alpha",
        )
        assert len(key) == 64
        assert int(key, 16) >= 0

    def test_param_order_independent(self):
        key_a = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {"a": 1, "b": 2},
            "sample_alpha",
        )
        key_b = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {"b": 2, "a": 1},
            "sample_alpha",
        )
        assert key_a == key_b

    def test_build_metadata_does_not_change_key(self):
        key_a = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {},
            "sample_alpha",
        )
        key_b = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4+build.7",
            {},
            "sample_alpha",
        )
        assert key_a == key_b

    def test_prerelease_changes_key(self):
        key_release = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {},
            "sample_alpha",
        )
        key_prerelease = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4-rc.1",
            {},
            "sample_alpha",
        )
        assert key_release != key_prerelease

    def test_parent_id_changes_key(self):
        key_alpha = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {},
            "sample_alpha",
        )
        key_beta = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4",
            {},
            "sample_beta",
        )
        assert key_alpha != key_beta

    def test_cache_type_changes_key(self):
        key_reads = derive_key(
            CacheType.trimmed_reads,
            "bowtie2",
            "2.5.1",
            {},
            "ref_alpha",
        )
        key_index = derive_key(
            CacheType.reference_mapping_index,
            "bowtie2",
            "2.5.1",
            {},
            "ref_alpha",
        )
        assert key_reads != key_index

    def test_matches_manual_sha256(self):
        """Pin the field layout: NUL-joined, normalized version, canonical params."""
        payload = "\x00".join(
            [
                "trimmed_reads",
                "fastp",
                "0.23.4",
                '{"min_length":50}',
                "sample_alpha",
            ],
        )
        expected = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        actual = derive_key(
            CacheType.trimmed_reads,
            "fastp",
            "0.23.4+build.7",
            {"min_length": 50},
            "sample_alpha",
        )
        assert actual == expected
