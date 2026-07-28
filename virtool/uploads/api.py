from virtool.api.errors import APINotFound
from virtool.api.routes import Routes
from virtool.api.streaming import stream_storage_response
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req

routes = Routes()


@routes.jobs_api.get("/uploads/{id}")
async def download(req):
    """Download an upload.

    Downloads an upload using its 'upload id'.
    """
    upload_id = int(req.match_info["id"])

    try:
        stream, size, name = await get_data_from_req(req).uploads.get_upload_file_info(
            upload_id
        )
    except ResourceNotFoundError:
        raise APINotFound()

    return await stream_storage_response(
        req,
        stream,
        {
            "Content-Disposition": f"attachment; filename={name}",
            "Content-Type": "application/octet-stream",
            "Content-Length": str(size),
        },
    )
