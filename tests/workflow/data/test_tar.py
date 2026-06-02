import tarfile
from pathlib import Path

import pytest

from virtool.workflow.data.tar import extract_tar_to_dir, write_path_as_tar


class TestWritePathAsTar:
    async def test_directory_keeps_top_level_name(self, tmp_path: Path):
        source = tmp_path / "index"
        nested = source / "nested"
        nested.mkdir(parents=True)
        (source / "reference.1.bt2").write_bytes(b"reference")
        (nested / "reference.2.bt2").write_bytes(b"nested-reference")
        archive_path = tmp_path / "cache.tar"

        await write_path_as_tar(source, archive_path)

        with tarfile.open(archive_path) as archive:
            assert sorted(archive.getnames()) == [
                "index",
                "index/nested",
                "index/nested/reference.2.bt2",
                "index/reference.1.bt2",
            ]


class TestExtractTarToDir:
    async def test_multiple_top_level_entries_raises(self, tmp_path: Path):
        archive_path = tmp_path / "cache.tar"
        target = tmp_path / "target"
        first = tmp_path / "first.txt"
        second = tmp_path / "second.txt"
        first.write_bytes(b"first")
        second.write_bytes(b"second")

        with tarfile.open(archive_path, mode="w") as archive:
            archive.add(first, arcname="first.txt")
            archive.add(second, arcname="second.txt")

        with pytest.raises(ValueError, match="exactly one top-level entry"):
            await extract_tar_to_dir(archive_path, target)

        assert not target.exists()
