import asyncio
from pathlib import Path
from shutil import rmtree


async def create_work_path(path: Path) -> Path:
    """A temporary working directory where all workflow files should be written."""
    path = Path(path).absolute()

    await asyncio.to_thread(rmtree, path, ignore_errors=True)
    await asyncio.to_thread(path.mkdir, exist_ok=True, parents=True)

    return path
