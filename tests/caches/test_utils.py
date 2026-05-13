import hashlib

from virtool.caches.types import CacheParams
from virtool.caches.utils import canonicalize_params, derive_key


class SkewerCacheParams(CacheParams):
    """Workflow-style params: a skewer-based read trimming run."""

    min_length: int = 0


class SortFieldParams(CacheParams):
    """Subclass with non-alphabetical field declaration order."""

    z_field: int = 0
    a_field: int = 0


class NestedMappingParams(CacheParams):
    """Subclass holding a nested mapping to exercise recursive key sorting."""

    extra: dict[str, int] = {}


class TestCanonicalizeParams:
    def test_base_only(self):
        params = CacheParams(tool_name="skewer", tool_version="0.2.2")
        assert (
            canonicalize_params(params)
            == '{"tool_name":"skewer","tool_version":"0.2.2"}'
        )

    def test_sorts_keys(self):
        params = SortFieldParams(
            tool_name="skewer",
            tool_version="0.2.2",
            z_field=1,
            a_field=2,
        )
        assert canonicalize_params(params) == (
            '{"a_field":2,"tool_name":"skewer","tool_version":"0.2.2","z_field":1}'
        )

    def test_tight_separators(self):
        params = SortFieldParams(
            tool_name="skewer",
            tool_version="0.2.2",
            z_field=1,
            a_field=2,
        )
        assert " " not in canonicalize_params(params)

    def test_escapes_non_ascii(self):
        params = CacheParams(tool_name="café", tool_version="0.2.2")
        assert (
            canonicalize_params(params)
            == '{"tool_name":"caf\\u00e9","tool_version":"0.2.2"}'
        )

    def test_nested_keys_sorted(self):
        params = NestedMappingParams(
            tool_name="skewer",
            tool_version="0.2.2",
            extra={"b": 1, "a": 2},
        )
        assert canonicalize_params(params) == (
            '{"extra":{"a":2,"b":1},"tool_name":"skewer","tool_version":"0.2.2"}'
        )


class TestDeriveKey:
    def test_returns_sha256_hex(self):
        key = derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            SkewerCacheParams(
                tool_name="skewer",
                tool_version="0.2.2",
                min_length=50,
            ),
        )
        assert len(key) == 64
        assert int(key, 16) >= 0

    def test_version_string_changes_key(self):
        key_release = derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            CacheParams(tool_name="skewer", tool_version="0.2.2"),
        )
        key_build = derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            CacheParams(tool_name="skewer", tool_version="0.2.2+build.7"),
        )
        assert key_release != key_build

    def test_prerelease_changes_key(self):
        key_release = derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            CacheParams(tool_name="skewer", tool_version="0.2.2"),
        )
        key_prerelease = derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            CacheParams(tool_name="skewer", tool_version="0.2.2-rc.1"),
        )
        assert key_release != key_prerelease

    def test_parent_id_changes_key(self):
        params = CacheParams(tool_name="skewer", tool_version="0.2.2")
        assert derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            params,
        ) != derive_key(
            "sample_trimmed_reads",
            "sample_beta",
            params,
        )

    def test_cache_type_changes_key(self):
        params = CacheParams(tool_name="bowtie2", tool_version="2.5.1")
        assert derive_key(
            "sample_trimmed_reads",
            "ref_alpha",
            params,
        ) != derive_key(
            "reference_mapping_index",
            "ref_alpha",
            params,
        )

    def test_tool_name_changes_key(self):
        assert derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            CacheParams(tool_name="skewer", tool_version="0.2.2"),
        ) != derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            CacheParams(tool_name="trimmomatic", tool_version="0.2.2"),
        )

    def test_subclass_field_changes_key(self):
        """Fields declared on a subclass contribute to the key."""
        assert derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            SkewerCacheParams(
                tool_name="skewer",
                tool_version="0.2.2",
                min_length=50,
            ),
        ) != derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            SkewerCacheParams(
                tool_name="skewer",
                tool_version="0.2.2",
                min_length=75,
            ),
        )

    def test_matches_manual_sha256(self):
        """Pin the field layout: NUL-joined, raw version, canonical params."""
        payload = "\x00".join(
            [
                "sample_trimmed_reads",
                '{"min_length":50,"tool_name":"skewer","tool_version":"0.2.2+build.7"}',
                "sample_alpha",
            ],
        )
        expected = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        actual = derive_key(
            "sample_trimmed_reads",
            "sample_alpha",
            SkewerCacheParams(
                tool_name="skewer",
                tool_version="0.2.2+build.7",
                min_length=50,
            ),
        )
        assert actual == expected
