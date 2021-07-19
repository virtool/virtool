from pathlib import Path
from typing import List

from aiohttp.web import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

from virtool.api.response import bad_request
from virtool.labels.models import Label

PATHOSCOPE_TASK_NAMES = [
    "pathoscope_bowtie",
    "pathoscope_barracuda"
]


def calculate_workflow_tags(analyses: list) -> dict:
    """
    Calculate the workflow tags (eg. "ip", True) that should be applied to a sample document based
    on a list of its associated analyses.

    :param analyses: the analyses to calculate tags for
    :return: workflow tags to apply to the sample document

    """
    pathoscope = False
    nuvs = False

    for analysis in analyses:
        if pathoscope is not True and analysis["workflow"] in PATHOSCOPE_TASK_NAMES:
            pathoscope = analysis["ready"] or "ip" or pathoscope

        if nuvs is not True and analysis["workflow"] == "nuvs":
            nuvs = analysis["ready"] or "ip" or nuvs

        if pathoscope is True and nuvs is True:
            break

    return {
        "pathoscope": pathoscope,
        "nuvs": nuvs
    }


async def check_labels(pg: AsyncEngine, labels: List[int]) -> List[int]:
    """"
    Check for existence of label IDs given in sample creation request

    :param pg: PostgreSQL database connection object
    :param labels: list of label IDs given in the sample creation request
    :return: a list containing any label IDs given in the request that do not exist
    """
    async with AsyncSession(pg) as session:
        query = await session.execute(select(Label.id).filter(Label.id.in_(labels)))
        results = {label for label in query.scalars().all()}

    return [label for label in labels if label not in results]


def get_sample_rights(sample: dict, client):
    if client.administrator or sample["user"]["id"] == client.user_id:
        return True, True

    is_group_member = sample["group"] and sample["group"] in client.groups

    read = sample["all_read"] or (is_group_member and sample["group_read"])

    if not read:
        return False, False

    write = sample["all_write"] or (is_group_member and sample["group_write"])

    return read, write


def bad_labels_response(labels: List[int]) -> Response:
    """
    Creates a response that indicates that some label IDs do not exist

    :param labels: A list of label IDs that do not exist
    :return: A `bad_request()` response
    """
    return bad_request(f"Labels do not exist: {', '.join(str(label) for label in labels)}")


def join_legacy_read_path(sample_path: Path, suffix: int) -> Path:
    """
    Create a path string for a sample read file using the old file naming
    convention (eg. reads_1.fastq).

    :param sample_path: the path to the sample directory
    :param suffix: the read file suffix
    :return: the read path

    """
    return sample_path / f"reads_{suffix}.fastq"


def join_legacy_read_paths(settings: dict, sample):
    """
    Create a list of paths for the read files associated with the `sample`.

    :param settings: the application settings
    :param sample: the sample document
    :return: a list of sample read paths

    """
    sample_path = join_sample_path(settings, sample["_id"])

    if not all(f["raw"] for f in sample["files"]):
        if sample["paired"]:
            return [
                join_legacy_read_path(sample_path, 1),
                join_legacy_read_path(sample_path, 2)
            ]

        return [join_legacy_read_path(sample_path, 1)]


def join_sample_path(settings, sample_id) -> Path:
    return settings["data_path"] / "samples" / sample_id
