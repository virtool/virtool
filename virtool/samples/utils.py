from enum import Enum
from pathlib import Path

from aiohttp.web import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.api.client import AbstractClient
from virtool.api.errors import APIBadRequest
from virtool.config.cls import Config
from virtool.labels.sql import SQLLabel

PATHOSCOPE_TASK_NAMES = ["pathoscope_bowtie", "pathoscope_barracuda"]


class SampleRight(Enum):
    read = "read"
    write = "write"


def calculate_workflow_tags(analyses: list) -> dict:
    """Calculate the workflow tags (eg. "ip", True) that should be applied to a sample
    document based on a list of its associated analyses.

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

    return {"pathoscope": pathoscope, "nuvs": nuvs}


async def check_labels(pg: AsyncEngine, labels: list[int]) -> list[int]:
    """Check for existence of label IDs given in sample creation request

    :param pg: PostgreSQL database connection object
    :param labels: list of label IDs given in the sample creation request
    :return: a list containing any label IDs given in the request that do not exist
    """
    async with AsyncSession(pg) as session:
        query = await session.execute(
            select(SQLLabel.id).where(SQLLabel.id.in_(labels)),
        )
        results = set(query.scalars().all())

    return [label for label in labels if label not in results]


def get_sample_rights(sample: dict, client: AbstractClient):
    if (
        client.administrator_role
        or sample["user"]["id"] == client.user_id
        or client.is_job
    ):
        return True, True

    is_group_member = sample["group"] and client.is_group_member(sample["group"])

    read = sample["all_read"] or (is_group_member and sample["group_read"])

    if not read:
        return False, False

    write = sample["all_write"] or (is_group_member and sample["group_write"])

    return read, write


def bad_labels_response(labels: list[int]) -> Response:
    """Creates a response that indicates that some label IDs do not exist

    :param labels: A list of label IDs that do not exist
    :return: A `bad_request()` response
    """
    raise APIBadRequest(
        f"Labels do not exist: {', '.join(str(label) for label in labels)}",
    )


def join_legacy_read_path(sample_path: Path, suffix: int) -> Path:
    """Create a path string for a sample read file using the old file naming
    convention (eg. reads_1.fastq).

    :param sample_path: the path to the sample directory
    :param suffix: the read file suffix
    :return: the read path

    """
    return sample_path / f"reads_{suffix}.fastq"


def join_sample_path(config: Config, sample_id) -> Path:
    return config.data_path / "samples" / sample_id
