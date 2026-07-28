"""API request handlers for managing and querying HMM data."""

from aiohttp.web_response import StreamResponse

from virtool.api.custom_json import json_response
from virtool.api.errors import APINotFound
from virtool.api.routes import Routes
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req

routes = Routes()


@routes.jobs_api.get("/hmms/{hmm_id}")
async def get(req):
    """Get a HMM annotation document.

    Fetches a complete individual HMM annotation document.
    """
    try:
        hmm_id = int(req.match_info["hmm_id"])
    except ValueError:
        raise APINotFound()

    try:
        hmm = await get_data_from_req(req).hmms.get(hmm_id)
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(hmm)


@routes.jobs_api.get("/hmms/files/annotations.json.gz")
async def get_hmm_annotations(req):
    """Get HMM annotations.

    Fetches a compressed json file containing the database documents for all HMMs.
    """
    try:
        stream, size = await get_data_from_req(req).hmms.download_annotations()
    except ResourceNotFoundError:
        raise APINotFound()

    try:
        first_chunk = await stream.__anext__()
    except StopAsyncIteration:
        raise APINotFound()

    response = StreamResponse(
        headers={
            "Content-Disposition": "attachment; filename=annotations.json.gz",
            "Content-Length": str(size),
            "Content-Type": "application/octet-stream",
        },
    )

    await response.prepare(req)
    await response.write(first_chunk)

    async for chunk in stream:
        await response.write(chunk)

    return response


@routes.jobs_api.get("/hmms/files/profiles.hmm")
async def get_hmm_profiles(req):
    """Get HMM profiles.

    Downloads the HMM profiles file if HMM data is available.
    """
    try:
        stream, size = await get_data_from_req(req).hmms.download_profiles()
    except ResourceNotFoundError:
        raise APINotFound()

    try:
        first_chunk = await stream.__anext__()
    except StopAsyncIteration:
        raise APINotFound()

    response = StreamResponse(
        headers={
            "Content-Disposition": "attachment; filename=profiles.hmm",
            "Content-Length": str(size),
            "Content-Type": "application/octet-stream",
        },
    )

    await response.prepare(req)
    await response.write(first_chunk)

    async for chunk in stream:
        await response.write(chunk)

    return response
