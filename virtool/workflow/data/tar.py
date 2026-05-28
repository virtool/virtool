import asyncio
import os
import tarfile
from collections.abc import AsyncIterator
from contextlib import suppress
from pathlib import Path

TAR_CHUNK_SIZE = 1024 * 1024 * 2


async def stream_dir_as_tar(directory: Path) -> AsyncIterator[bytes]:
    if not directory.is_dir():
        raise NotADirectoryError(directory)

    read_fd, write_fd = os.pipe()

    def write_tar() -> None:
        with os.fdopen(write_fd, "wb", closefd=True) as pipe:
            with tarfile.open(fileobj=pipe, mode="w|") as archive:
                for path in sorted(directory.rglob("*")):
                    if path.is_file():
                        archive.add(
                            path,
                            arcname=path.relative_to(directory).as_posix(),
                        )

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
