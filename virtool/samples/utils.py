from enum import Enum

from aiohttp.web import Response
from sqlalchemy import Row, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.utils import WORKFLOW_NAMES
from virtool.api.client import AbstractClient
from virtool.api.errors import APIBadRequest
from virtool.labels.sql import SQLLabel
from virtool.models.roles import AdministratorRole
from virtool.samples.models import WorkflowState
from virtool.samples.sql import SQLLegacySample


class SampleRight(Enum):
    read = "read"
    write = "write"


SAMPLE_RIGHTS_COLUMNS = (
    SQLLegacySample.all_read,
    SQLLegacySample.all_write,
    SQLLegacySample.group_read,
    SQLLegacySample.group_write,
    SQLLegacySample.group_id,
    SQLLegacySample.user_id,
)
"""The ``legacy_samples`` columns :func:`has_sample_right` needs to resolve a right."""


def has_sample_right(
    row: Row,
    client: AbstractClient,
    right: SampleRight,
) -> bool:
    """Resolve whether ``client`` holds ``right`` on a sample.

    ``row`` must carry the columns in :data:`SAMPLE_RIGHTS_COLUMNS`. Shared by the
    samples and analyses domains so a sample and the analyses on it never disagree
    about who may read or write them.

    Full administrators, job-authenticated clients, and the sample's owner always
    hold every right.
    """
    if (
        client.administrator_role == AdministratorRole.FULL
        or client.is_job
        or client.user_id == row.user_id
    ):
        return True

    is_group_member = row.group_id is not None and client.is_group_member(row.group_id)

    if right is SampleRight.read:
        return row.all_read or (is_group_member and row.group_read)

    if right is SampleRight.write:
        return row.all_write or (is_group_member and row.group_write)

    raise ValueError(f"Invalid sample right: {right}")


def encode_workflow_tags(ready_by_workflow: dict[str, bool]) -> dict:
    """Encode a sample's workflow tags from its analyses.

    This is the single shared encoding used when deriving tags for both list and
    single reads. ``ready_by_workflow`` maps each workflow that has at least one
    analysis to whether any of those analyses is ready; workflows with no analyses
    are absent and stay ``none``.

    Returns the legacy ``nuvs`` and ``pathoscope`` tags (``True``, ``"ip"`` or
    ``False``) alongside the ``workflows`` state map.

    :param ready_by_workflow: whether each workflow has a ready analysis
    :return: the ``nuvs``, ``pathoscope`` and ``workflows`` fields
    """
    workflows = dict.fromkeys(WORKFLOW_NAMES, WorkflowState.NONE.value)

    for workflow_name, ready in ready_by_workflow.items():
        workflows[workflow_name] = (
            WorkflowState.COMPLETE.value if ready else WorkflowState.PENDING.value
        )

    return {
        "nuvs": _encode_legacy_tag(ready_by_workflow.get("nuvs")),
        "pathoscope": _encode_legacy_tag(ready_by_workflow.get("pathoscope")),
        "workflows": workflows,
    }


def _encode_legacy_tag(ready: bool | None) -> bool | str:
    """Encode the legacy top-level workflow tag for a single workflow.

    ``None`` (no analyses) is ``False``, a ready analysis is ``True`` and an
    unfinished analysis is ``"ip"``.
    """
    if ready is None:
        return False

    return True if ready else "ip"


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


def bad_labels_response(labels: list[int]) -> Response:
    """Creates a response that indicates that some label IDs do not exist

    :param labels: A list of label IDs that do not exist
    :return: A `bad_request()` response
    """
    raise APIBadRequest(
        f"Labels do not exist: {', '.join(str(label) for label in labels)}",
    )


def sample_file_key(storage_id: str, filename: str) -> str:
    return f"samples/{storage_id}/{filename}"


def sample_prefix(storage_id: str) -> str:
    return f"samples/{storage_id}/"
