from pathlib import Path

from pytest_mock import MockerFixture

from virtool.storage.file import read_file_chunks


class TestReadFileChunks:
    async def test_yields_fixed_size_chunks(
        self,
        mocker: MockerFixture,
        tmp_path: Path,
    ) -> None:
        mocker.patch("virtool.storage.file.STORAGE_CHUNK_SIZE", 4)
        path = tmp_path / "source.bin"
        path.write_bytes(b"abcdefghij")

        chunks = [chunk async for chunk in read_file_chunks(path)]

        assert chunks == [b"abcd", b"efgh", b"ij"]

    async def test_empty_file_yields_no_chunks(self, tmp_path: Path) -> None:
        path = tmp_path / "empty.bin"
        path.touch()

        assert [chunk async for chunk in read_file_chunks(path)] == []
