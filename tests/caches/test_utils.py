import hashlib

import pytest

from virtool.caches.types import CacheType
from virtool.caches.utils import (
    build_stored_params,
    canonicalize_params,
    derive_key,
    normalize_semver,
)


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


class TestBuildStoredParams:
    def test_merges_tool_fields(self):
        assert build_stored_params("fastp", "0.23.4", {"min_length": 50}) == {
            "tool_name": "fastp",
            "tool_version": "0.23.4",
            "min_length": 50,
        }

    def test_normalizes_version(self):
        result = build_stored_params("fastp", "v0.23.4+build.7", {})
        assert result["tool_version"] == "0.23.4"

    def test_explicit_args_win_over_params(self):
        result = build_stored_params(
            "fastp",
            "0.23.4",
            {"tool_name": "trimmomatic", "tool_version": "1.0.0"},
        )
        assert result["tool_name"] == "fastp"
        assert result["tool_version"] == "0.23.4"

    def test_empty_params(self):
        assert build_stored_params("fastp", "0.23.4", {}) == {
            "tool_name": "fastp",
            "tool_version": "0.23.4",
        }


class TestDeriveKey:
    def test_returns_sha256_hex(self):
        key = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4",
            {"min_length": 50},
        )
        assert len(key) == 64
        assert int(key, 16) >= 0

    def test_param_order_independent(self):
        key_a = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4",
            {"a": 1, "b": 2},
        )
        key_b = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4",
            {"b": 2, "a": 1},
        )
        assert key_a == key_b

    def test_build_metadata_does_not_change_key(self):
        key_a = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4",
            {},
        )
        key_b = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4+build.7",
            {},
        )
        assert key_a == key_b

    def test_prerelease_changes_key(self):
        key_release = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4",
            {},
        )
        key_prerelease = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4-rc.1",
            {},
        )
        assert key_release != key_prerelease

    def test_parent_id_changes_key(self):
        key_alpha = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4",
            {},
        )
        key_beta = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_beta",
            "fastp",
            "0.23.4",
            {},
        )
        assert key_alpha != key_beta

    def test_cache_type_changes_key(self):
        key_reads = derive_key(
            CacheType.sample_trimmed_reads,
            "ref_alpha",
            "bowtie2",
            "2.5.1",
            {},
        )
        key_index = derive_key(
            CacheType.reference_mapping_index,
            "ref_alpha",
            "bowtie2",
            "2.5.1",
            {},
        )
        assert key_reads != key_index

    def test_tool_name_changes_key(self):
        key_fastp = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4",
            {},
        )
        key_other = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "trimmomatic",
            "0.23.4",
            {},
        )
        assert key_fastp != key_other

    def test_matches_manual_sha256(self):
        """Pin the field layout: NUL-joined, normalized version, canonical params."""
        payload = "\x00".join(
            [
                "sample_trimmed_reads",
                '{"min_length":50,"tool_name":"fastp","tool_version":"0.23.4"}',
                "sample_alpha",
            ],
        )
        expected = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        actual = derive_key(
            CacheType.sample_trimmed_reads,
            "sample_alpha",
            "fastp",
            "0.23.4+build.7",
            {"min_length": 50},
        )
        assert actual == expected
