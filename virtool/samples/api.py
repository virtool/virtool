import asyncio

from aiohttp.web import (
    Request,
    Response,
)
from structlog import get_logger

from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIBadRequest,
    APIConflict,
    APIInvalidQuery,
    APINoContent,
    APINotFound,
)
from virtool.api.routes import Routes
from virtool.api.schema import schema
from virtool.api.streaming import stream_storage_response
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.jobs.models import TERMINAL_JOB_STATES
from virtool.uploads.utils import (
    multipart_file_chunker,
    naive_validator,
)

logger = get_logger("samples")

routes = Routes()

DELETABLE_JOB_STATES = {s.value for s in TERMINAL_JOB_STATES}
"""Job states that allow sample deletion.

Samples with jobs in these states can be deleted because the jobs are no longer
active and will not be resumed.
"""


@routes.jobs_api.get("/samples/{sample_id}")
async def get_sample(req):
    """Get a sample.

    Fetches a complete sample document from a job.

    """
    sample_id = req.match_info["sample_id"]

    try:
        sample = await get_data_from_req(req).samples.get(sample_id)
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(sample)


@routes.jobs_api.patch("/samples/{sample_id}")
@schema({"quality": {"type": "dict", "required": True}})
async def finalize(req):
    """Finalize a sample.

    Set the sample's quality field and the `ready` field to `True`.

    """
    data = req["data"]

    sample_id = req.match_info["sample_id"]

    try:
        sample = await get_data_from_req(req).samples.finalize(
            sample_id,
            data["quality"],
        )
    except ResourceConflictError as err:
        raise APIConflict(str(err))
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(sample)


@routes.jobs_api.delete("/samples/{sample_id}")
async def job_remove(req):
    """Remove a job.

    Removes a sample document and all associated analyses.

    Only usable in the Jobs API and when samples are unfinalized.

    """
    sample_id = req.match_info["sample_id"]

    try:
        sample = await get_data_from_req(req).samples.get(sample_id)
    except ResourceNotFoundError:
        raise APINotFound()

    if sample.ready:
        raise APIBadRequest("Only unfinalized samples can be deleted")

    if sample.job is not None and sample.job.state.value not in DELETABLE_JOB_STATES:
        raise APIBadRequest(
            f"Cannot delete sample with active job (current state: {sample.job.state.value})"
        )

    try:
        await get_data_from_req(req).samples.delete(sample_id)
    except ResourceNotFoundError:
        raise APINotFound()

    raise APINoContent()


@routes.jobs_api.post("/samples/{sample_id}/artifacts")
async def upload_artifact(req):
    """Upload an artifact.

    Uploads artifact created during sample creation using the Jobs API.
    """
    sample_id = req.match_info["sample_id"]
    artifact_type = req.query.get("type")

    if errors := naive_validator(req):
        raise APIInvalidQuery(errors)

    name = req.query.get("name")

    try:
        artifact = await get_data_from_req(req).samples.upload_artifact(
            sample_id,
            artifact_type,
            name,
            multipart_file_chunker(await req.multipart()),
        )
    except ResourceNotFoundError:
        raise APINotFound()
    except ResourceConflictError as err:
        if "Unsupported" in str(err):
            raise APIBadRequest(str(err))
        raise APIConflict(str(err))
    except asyncio.CancelledError:
        logger.info(
            "Sample artifact file upload aborted",
            sample_id=sample_id,
        )
        return Response(status=499)

    return json_response(
        artifact,
        status=201,
        headers={"Location": f"/samples/{sample_id}/artifact/{name}"},
    )


@routes.jobs_api.put("/samples/{sample_id}/reads/{filename}")
async def upload_reads(req):
    """Upload reads.

    Uploads sample reads using the Jobs API.
    """
    name = req.match_info["filename"]
    sample_id = req.match_info["sample_id"]

    try:
        upload = int(req.query.get("upload"))
    except TypeError:
        upload = None

    if name not in ["reads_1.fq.gz", "reads_2.fq.gz"]:
        raise APIBadRequest("File name is not an accepted reads file")

    try:
        reads = await get_data_from_req(req).samples.upload_reads(
            sample_id,
            name,
            multipart_file_chunker(await req.multipart()),
            upload_id=upload,
        )
    except ResourceNotFoundError:
        raise APINotFound()
    except EOFError:
        raise APIBadRequest("Reads file is empty")
    except OSError:
        raise APIBadRequest("File is not compressed")
    except ResourceConflictError as err:
        raise APIConflict(str(err))
    except asyncio.CancelledError:
        logger.info("sample reads upload aborted", sample_id=sample_id)
        return Response(status=499)

    return json_response(
        reads,
        status=201,
        headers={"Location": f"/samples/{sample_id}/reads/{reads['name_on_disk']}"},
    )


@routes.jobs_api.get("/samples/{sample_id}/reads/reads_{suffix}.fq.gz")
async def download_reads(req: Request):
    """Download reads.

    Downloads the sample reads file.
    """
    sample_id = req.match_info["sample_id"]
    suffix = req.match_info["suffix"]
    file_name = f"reads_{suffix}.fq.gz"

    try:
        stream, size, name = await get_data_from_req(req).samples.get_reads_file(
            sample_id,
            file_name,
        )
    except ResourceNotFoundError:
        raise APINotFound()

    return await stream_storage_response(
        req,
        stream,
        {
            "Content-Length": str(size),
            "Content-Type": "application/gzip",
        },
    )


@routes.jobs_api.get("/samples/{sample_id}/artifacts/{filename}")
async def download_artifact(req: Request):
    """Download artifact.

    Downloads the sample artifact.

    """
    sample_id = req.match_info["sample_id"]
    filename = req.match_info["filename"]

    try:
        stream, size = await get_data_from_req(req).samples.get_artifact_file(
            sample_id,
            filename,
        )
    except ResourceNotFoundError:
        raise APINotFound()

    return await stream_storage_response(
        req,
        stream,
        {
            "Content-Length": str(size),
            "Content-Type": "application/gzip",
        },
    )
