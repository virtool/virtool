import asyncio
import os
import tarfile
from collections.abc import AsyncIterator
from contextlib import suppress
from pathlib import Path
from typing import BinaryIO

TAR_CHUNK_SIZE = 1024 * 1024 * 2


class _CountingWriter:
    def __init__(self) -> None:
        self.size = 0

    def write(self, data: bytes) -> int:
        self.size += len(data)
        return len(data)


def _write_dir_as_tar(directory: Path, fileobj: BinaryIO | _CountingWriter) -> None:
    if not directory.is_dir():
        raise NotADirectoryError(directory)

    with tarfile.open(fileobj=fileobj, mode="w|") as archive:
        for path in sorted(directory.rglob("*")):
            if path.is_file():
                archive.add(
                    path,
                    arcname=path.relative_to(directory).as_posix(),
                )


async def get_tar_size(directory: Path) -> int:
    writer = _CountingWriter()

    await asyncio.to_thread(_write_dir_as_tar, directory, writer)

    return writer.size


async def extract_tar_to_dir(archive_path: Path, directory: Path) -> None:
    def extract() -> None:
        directory.mkdir(parents=True, exist_ok=True)

        with tarfile.open(archive_path, mode="r:*") as archive:
            archive.extractall(directory, filter="data")

    await asyncio.to_thread(extract)


async def stream_dir_as_tar(directory: Path) -> AsyncIterator[bytes]:
    read_fd, write_fd = os.pipe()

    def write_tar() -> None:
        with os.fdopen(write_fd, "wb", closefd=True) as pipe:
            _write_dir_as_tar(directory, pipe)

    producer = asyncio.create_task(asyncio.to_thread(write_tar))

    try:
        with os.fdopen(read_fd, "rb", closefd=True) as pipe:
            while chunk := await asyncio.to_thread(pipe.read, TAR_CHUNK_SIZE):
                yield chunk

        await producer
    finally:
        if not producer.done():
            producer.cancel()
            with suppress(asyncio.CancelledError):
                await producer
