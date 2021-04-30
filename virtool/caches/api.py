"""
API request handlers for sample caches.

"""
import aiohttp.web
from aiohttp.web_fileresponse import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio.session import AsyncSession

import virtool.analyses.utils
import virtool.caches.db
import virtool.db.utils
import virtool.http.routes
import virtool.users.db
import virtool.utils
import virtool.validators
from virtool.api.response import json_response, not_found
from virtool.caches.models import SampleArtifactCache

routes = virtool.http.routes.Routes()


@routes.get("/api/caches/{cache_id}")
@routes.jobs_api.get("/api/caches/{cache_id}")
async def get(req: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    Return the complete representation for the cache with the given `cache_id`.

    """
    db = req.app["db"]
    cache_id = req.match_info["cache_id"]

    cache = await virtool.caches.db.get(db, cache_id)

    if cache is None:
        return not_found()

    return json_response(cache)


@routes.jobs_api.get("/api/caches/{key}/artifacts/{filename}")
async def download_artifact_cache(req):
    """
    Download sample artifact cache for a given key.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    key = req.match_info["key"]
    filename = req.match_info["filename"]

    if not (document := await db.caches.find_one({"key": key})) or not (sample_id := document.get("sample").get("id")):
        return not_found()

    async with AsyncSession(pg) as session:
        result = (
            await session.execute(select(SampleArtifactCache).filter_by(name=filename, key=key, sample=sample_id))
        ).scalar()

    if not result:
        return not_found()

    artifact = result.to_dict()

    file_path = req.app["settings"]["data_path"] / "caches" / key / artifact["name_on_disk"]

    if not file_path.exists():
        return not_found()

    headers = {
        "Content-Length": virtool.utils.file_stats(file_path)["size"],
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.jobs_api.get("/api/caches/{key}/reads/reads_{suffix}.fq.gz")
async def download_reads_cache(req):
    """
    Download sample reads cache for a given key.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    key = req.match_info["key"]
    suffix = req.match_info["suffix"]

    file_name = f"reads_{suffix}.fq.gz"

    if not (document := await db.caches.find_one({"key": key})) or not (sample_id := document.get("sample").get("id")):
        return not_found()

    existing_reads = await virtool.samples.files.get_existing_reads(pg, sample_id, key=key)

    if file_name not in existing_reads:
        return not_found()

    file_path = req.app["settings"]["data_path"] / "caches" / key / file_name

    if not file_path.exists():
        return not_found()

    headers = {
        "Content-Length": virtool.utils.file_stats(file_path)["size"],
        "Content-Type": "application/gzip"
    }

    return FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)
