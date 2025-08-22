import asyncio
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pyfixtures import fixture
from structlog import get_logger

from virtool.jobs.models import Job
from virtool.models.enums import LibraryType
from virtool.samples.models import Quality, Sample
from virtool.workflow.analysis.utils import ReadPaths
from virtool.workflow.api.client import APIClient
from virtool.workflow.data.uploads import WFUploads
from virtool.workflow.errors import JobsAPINotFoundError
from virtool.workflow.files import VirtoolFileFormat

logger = get_logger("api")


@dataclass
class WFSample:
    """A sample whose data is being used in a workflow."""

    id: str
    """The unique ID of the sample."""

    library_type: LibraryType
    """The library type of the sample."""

    name: str
    """The sample's name."""

    paired: bool
    """Whether the sample consists of paired reads."""

    quality: Quality
    """The quality data for the sample."""

    read_paths: ReadPaths
    """The paths to the raw sample reads."""

    @property
    def min_length(self) -> int | None:
        """The minimum observed read length in the sample sequencing data.

        Returns ``None`` if the sample is still being created and no quality data is available.

        """
        return self.quality.length[0] if self.quality else None

    @property
    def max_length(self) -> int | None:
        """The maximum observed read length in the sample sequencing data.

        Returns ``None`` if the sample is still being created and no quality data is available.

        """
        return self.quality.length[1] if self.quality else None


@dataclass
class WFNewSampleUpload:
    id: int
    name: str
    size: int
    path: Path


@dataclass
class WFNewSample:
    """A sample that is being created in the workflow."""

    id: str
    name: str
    paired: bool
    uploads: tuple[WFNewSampleUpload] | tuple[WFNewSampleUpload, WFNewSampleUpload]

    delete: Callable[[], Coroutine[None, None, None]]
    finalize: Callable[[dict[str, Any]], Coroutine[None, None, None]]
    upload: Callable[[Path, VirtoolFileFormat], Coroutine[None, None, None]]


@fixture
async def sample(
    _api: APIClient,
    job: Job,
    uploads: WFUploads,
    work_path: Path,
) -> WFSample:
    """The sample associated with the current job."""
    id_ = job.args["sample_id"]

    base_url_path = f"/samples/{id_}"

    try:
        sample_json = await _api.get_json(base_url_path)
    except JobsAPINotFoundError:
        raise JobsAPINotFoundError("Sample not found")

    sample = Sample(**sample_json)

    reads_path = work_path / "reads"
    await asyncio.to_thread(reads_path.mkdir, exist_ok=True, parents=True)

    await _api.get_file(
        f"{base_url_path}/reads/reads_1.fq.gz",
        reads_path / "reads_1.fq.gz",
    )

    if sample.paired:
        read_paths = (
            reads_path / "reads_1.fq.gz",
            reads_path / "reads_2.fq.gz",
        )
        await _api.get_file(
            f"{base_url_path}/reads/reads_2.fq.gz",
            reads_path / "reads_2.fq.gz",
        )
    else:
        read_paths = (reads_path / "reads_1.fq.gz",)

    return WFSample(
        id=sample.id,
        library_type=sample.library_type,
        name=sample.name,
        paired=sample.paired,
        quality=sample.quality,
        read_paths=read_paths,
    )


@fixture
async def new_sample(
    _api: APIClient,
    job: Job,
    uploads: WFUploads,
    work_path: Path,
) -> WFNewSample:
    """The sample associated with the current job."""
    id_ = job.args["sample_id"]

    log = logger.bind(resource="sample", id=id_)
    log.info("loading sample for sample creation")

    base_url_path = f"/samples/{id_}"

    sample_dict = await _api.get_json(base_url_path)
    sample = Sample(**sample_dict)

    log.info("got sample json")

    uploads_path = work_path / "uploads"
    await asyncio.to_thread(uploads_path.mkdir, exist_ok=True, parents=True)

    log.info("created uploads directory")

    files = tuple(
        WFNewSampleUpload(
            id=f["id"],
            name=f["name"],
            path=Path(uploads_path / f["name"]),
            size=f["size"],
        )
        for f in job.args["files"]
    )

    await asyncio.gather(*[uploads.download(f.id, f.path) for f in files])

    log.info("downloaded sample files")

    async def finalize(quality: dict[str, Any]):
        await _api.patch_json(base_url_path, data={"quality": quality})

    async def delete():
        await _api.delete(base_url_path)

    async def upload(path: Path, fmt: VirtoolFileFormat = "fastq"):
        await _api.put_file(f"{base_url_path}/reads/{path.name}", path, "fastq")

    return WFNewSample(
        id=sample.id,
        delete=delete,
        finalize=finalize,
        name=sample.name,
        paired=sample.paired,
        upload=upload,
        uploads=files,
    )
