import shutil
from pathlib import Path

from syrupy import SnapshotAssertion

from virtool.quality.fastqc import parse_fastqc_file


def test_parse_fastqc_file(
    example_path: Path, snapshot: SnapshotAssertion, tmpdir: Path
):
    """Test that the FASTQC parser works as expected."""
    shutil.copy(example_path / "fastqc.txt", tmpdir)

    result = parse_fastqc_file(tmpdir / "fastqc.txt")

    assert result.dict() == snapshot
