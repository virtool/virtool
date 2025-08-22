import asyncio
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from pathlib import Path

from pyfixtures import fixture
from structlog import get_logger

from virtool.jobs.models import Job
from virtool.subtractions.models import (
    NucleotideComposition,
    Subtraction,
    SubtractionFile,
)
from virtool.workflow.api.client import APIClient
from virtool.workflow.data.analyses import WFAnalysis
from virtool.workflow.data.uploads import WFUploads
from virtool.workflow.errors import MissingJobArgumentError

logger = get_logger("api")


@dataclass
class WFSubtraction:
    """A Virtool subtraction that has been loaded into the workflow environment.

    The subtraction files are downloaded to the workflow's local work path so they can
    be used for analysis.
    """

    id: str
    """The unique ID for the subtraction."""

    files: list[SubtractionFile]
    """The files associated with the subtraction."""

    gc: NucleotideComposition
    """The nucleotide composition of the subtraction."""

    nickname: str
    """The nickname for the subtraction."""

    name: str
    """The display name for the subtraction."""

    path: Path
    """
    The path to the subtraction directory.

    The subtraction directory contains the FASTA and Bowtie2 files for the subtraction.
    """

    @property
    def fasta_path(self) -> Path:
        """The path to the gzipped FASTA file for the subtraction."""
        return self.path / "subtraction.fa.gz"

    @property
    def bowtie2_index_path(self) -> Path:
        """The path to Bowtie2 prefix in the running workflow's work_path

        For example, ``/work/subtractions/<id>/subtraction`` refers to the Bowtie2
        index that comprises the files:

        - ``/work/subtractions/<id>/subtraction.1.bt2``
        - ``/work/subtractions/<id>/subtraction.2.bt2``
        - ``/work/subtractions/<id>/subtraction.3.bt2``
        - ``/work/subtractions/<id>/subtraction.4.bt2``
        - ``/work/subtractions/<id>/subtraction.rev.1.bt2``
        - ``/work/subtractions/<id>/subtraction.rev.2.bt2``

        """
        return self.path / "subtraction"


@dataclass
class WFNewSubtraction:
    id: str
    """The unique ID for the subtraction."""

    delete: Callable[[], Coroutine[None, None, None]]
    """
    A callable that deletes the subtraction from Virtool.

    This should be called if the subtraction creation fails before the subtraction is
    finalized.
    """

    finalize: Callable[[dict[str, int | float], int], Coroutine[None, None, None]]
    """
    A callable that finalizes the subtraction in Virtool.

    This makes it impossible to further alter the files and ready state of the
    subtraction. This must be called before the workflow ends to make the subtraction
    usable.
    """

    name: str
    """The display name for the subtraction."""

    nickname: str
    """An optional nickname for the subtraction."""

    path: Path
    """
    The path to the subtraction directory.

    The data files for the subtraction should be created here.
    """

    upload: Callable[[Path], Coroutine[None, None, None]]

    @property
    def fasta_path(self) -> Path:
        """The path to the FASTA file that should be used to create the subtraction."""
        return self.path / "subtraction.fa.gz"


@fixture
async def subtractions(
    _api: APIClient,
    analysis: WFAnalysis,
    work_path: Path,
) -> list[WFSubtraction]:
    """The subtractions to be used for the current analysis job."""
    subtraction_work_path = work_path / "subtractions"
    await asyncio.to_thread(subtraction_work_path.mkdir)

    subtractions_ = []

    for subtraction_id in [s.id for s in analysis.subtractions]:
        subtraction_json = await _api.get_json(f"/subtractions/{subtraction_id}")
        subtraction = Subtraction(**subtraction_json)
        subtraction = WFSubtraction(
            id=subtraction.id,
            files=subtraction.files,
            gc=subtraction.gc,
            nickname=subtraction.nickname,
            name=subtraction.name,
            path=subtraction_work_path / subtraction.id,
        )

        await asyncio.to_thread(subtraction.path.mkdir, parents=True, exist_ok=True)

        subtractions_.append(subtraction)

    # Do this in a separate loop in case fetching the JSON fails. This prevents
    # expensive and unnecessary file downloads.
    for subtraction in subtractions_:
        logger.info("downloading subtraction files", id=subtraction.id)

        for subtraction_file in subtraction.files:
            await _api.get_file(
                f"/subtractions/{subtraction.id}/files/{subtraction_file.name}",
                subtraction.path / subtraction_file.name,
            )

    return subtractions_


@fixture
async def new_subtraction(
    _api: APIClient,
    job: Job,
    uploads: WFUploads,
    work_path: Path,
) -> WFNewSubtraction:
    """A new subtraction that will be created during the current job.

    Currently only used for the `create-subtraction` workflow.
    """
    try:
        id_ = job.args["subtraction_id"]
    except KeyError:
        raise MissingJobArgumentError("subtraction_id")

    try:
        upload_id = job.args["files"][0]["id"]
    except KeyError:
        raise MissingJobArgumentError("files")

    subtraction_json = await _api.get_json(f"/subtractions/{id_}")
    subtraction_ = Subtraction(**subtraction_json)

    subtraction_work_path = work_path / "subtractions" / subtraction_.id
    await asyncio.to_thread(subtraction_work_path.mkdir, parents=True, exist_ok=True)

    await uploads.download(upload_id, subtraction_work_path / "subtraction.fa.gz")

    url_path = f"/subtractions/{subtraction_.id}"

    async def delete():
        """Delete the subtraction if the job fails."""
        await _api.delete(f"/subtractions/{subtraction_.id}")

    async def finalize(gc: dict[str, int | float], count: int):
        """Finalize the subtraction by setting the gc.

        :param gc: the nucleotide composition of the subtraction
        :param count: the number of sequences in the FASTA file
        :return: the updated subtraction.
        """
        gc_ = NucleotideComposition(**{"n": 0.0, **gc})

        await _api.patch_json(url_path, {"gc": gc_.dict(), "count": count})

    async def upload(path: Path):
        """Upload a file relating to this subtraction.

        Filenames must be one of:
            - subtraction.fa.gz
            - subtraction.1.bt2
            - subtraction.2.bt2
            - subtraction.3.bt2
            - subtraction.4.bt2
            - subtraction.rev.1.bt2
            - subtraction.rev.2.bt2

        :param path: The path to the file

        """
        filename = path.name

        log = logger.bind(id=id_, filename=filename)

        log.info("Uploading subtraction file")

        await _api.put_file(
            f"/subtractions/{subtraction_.id}/files/{filename}",
            path,
            "unknown",
        )

        log.info("Finished uploading subtraction file")

    return WFNewSubtraction(
        id=subtraction_.id,
        name=subtraction_.name,
        nickname=subtraction_.nickname,
        path=subtraction_work_path,
        delete=delete,
        finalize=finalize,
        upload=upload,
    )
