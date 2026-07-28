from aiohttp.web import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.utils import WORKFLOW_NAMES
from virtool.api.errors import APIBadRequest
from virtool.labels.sql import SQLLabel
from virtool.samples.models import WorkflowState


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


def sample_storage_id(sample_id: int, legacy_id: str | None) -> str:
    """Get the identifier a sample's storage objects are keyed under.

    A sample keeps a single storage prefix for its whole life: its Mongo ``_id`` if
    it has one, and its integer primary key otherwise. Samples created natively in
    Postgres have no ``legacy_id`` and are keyed by primary key from the start.

    Deleting a sample removes its prefix in one operation, so a sample whose files
    were split across two prefixes would have half of them orphaned.
    """
    return legacy_id or str(sample_id)


def sample_file_key(storage_id: str, filename: str) -> str:
    return f"samples/{storage_id}/{filename}"


def sample_prefix(storage_id: str) -> str:
    return f"samples/{storage_id}/"
