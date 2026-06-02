import asyncio
import tarfile
from pathlib import Path


def _add_path_to_archive(source: Path, archive: tarfile.TarFile) -> None:
    if source.is_file() or source.is_dir():
        archive.add(source, arcname=source.name)
        return

    raise FileNotFoundError(source)


def _check_member(member: tarfile.TarInfo) -> tuple[str, ...]:
    if not member.isdir() and not member.isfile():
        raise ValueError(f"Unsupported tar member type: {member.name}")

    if member.name.startswith("/"):
        raise ValueError(f"Tar member uses an absolute path: {member.name}")

    parts = tuple(member.name.split("/"))

    if not parts or any(part in {"", ".", ".."} for part in parts):
        raise ValueError(f"Tar member uses an unsafe path: {member.name}")

    return parts


def _check_archive(archive: tarfile.TarFile, directory: Path) -> Path:
    top_level_names = set()

    for member in archive.getmembers():
        parts = _check_member(member)
        top_level_names.add(parts[0])

    if not top_level_names:
        raise ValueError("Tar archive is empty")

    if len(top_level_names) > 1:
        raise ValueError("Tar archive must contain exactly one top-level entry")

    restored_path = directory / top_level_names.pop()

    if restored_path.exists() or restored_path.is_symlink():
        raise FileExistsError(restored_path)

    return restored_path


async def extract_tar_to_dir(archive_path: Path, directory: Path) -> Path:
    def extract() -> Path:
        if directory.exists() and not directory.is_dir():
            raise NotADirectoryError(directory)

        with tarfile.open(archive_path, mode="r:*") as archive:
            restored_path = _check_archive(archive, directory)
            directory.mkdir(parents=True, exist_ok=True)
            archive.extractall(directory, filter="data")

        return restored_path

    return await asyncio.to_thread(extract)


async def write_path_as_tar(source: Path, archive_path: Path) -> None:
    def write() -> None:
        archive_path.parent.mkdir(parents=True, exist_ok=True)

        with tarfile.open(archive_path, mode="w") as archive:
            _add_path_to_archive(source, archive)

    await asyncio.to_thread(write)
