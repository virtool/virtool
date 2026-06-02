import asyncio
import tarfile
from pathlib import Path


def _add_path_to_archive(source: Path, archive: tarfile.TarFile) -> None:
    if source.is_file():
        archive.add(source, arcname=source.name)
        return

    if source.is_dir():
        for path in sorted(source.rglob("*")):
            if path.is_file():
                archive.add(
                    path,
                    arcname=path.relative_to(source).as_posix(),
                )
        return

    raise FileNotFoundError(source)


async def extract_tar_to_dir(archive_path: Path, directory: Path) -> None:
    def extract() -> None:
        directory.mkdir(parents=True, exist_ok=True)

        with tarfile.open(archive_path, mode="r:*") as archive:
            archive.extractall(directory, filter="data")

    await asyncio.to_thread(extract)


async def write_path_as_tar(source: Path, archive_path: Path) -> None:
    def write() -> None:
        archive_path.parent.mkdir(parents=True, exist_ok=True)

        with tarfile.open(archive_path, mode="w") as archive:
            _add_path_to_archive(source, archive)

    await asyncio.to_thread(write)
