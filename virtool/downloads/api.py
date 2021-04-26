"""
Provides request handlers for file downloads.

"""
import os

from aiohttp import web

import virtool.analyses.db
import virtool.analyses.format
import virtool.api.json
import virtool.api.response
import virtool.bio
import virtool.caches.db
import virtool.caches.utils
import virtool.db.utils
import virtool.downloads.db
import virtool.downloads.utils
import virtool.errors
import virtool.history.db
import virtool.http.routes
import virtool.otus.db
import virtool.otus.utils
import virtool.references.db
import virtool.samples.utils
import virtool.subtractions.utils
import virtool.utils

routes = virtool.http.routes.Routes()


@routes.get("/download/caches/{cache_id}/reads_{suffix}.fq.gz")
async def download_cache_reads(req):
    """
    Download the cached trimmed data for the sample.

    """
    db = req.app["db"]

    cache_id = req.match_info["cache_id"]
    suffix = req.match_info["suffix"]

    files = await virtool.db.utils.get_one_field(db.caches, "files", cache_id)

    if not files:
        return virtool.api.response.not_found()

    cache_path = virtool.caches.utils.join_cache_path(req.app["settings"], cache_id)
    file_path = virtool.samples.utils.join_read_path(cache_path, suffix)

    if not os.path.isfile(file_path):
        return virtool.api.response.not_found()

    file_stats = virtool.utils.file_stats(file_path)

    headers = {
        "Content-Length": file_stats["size"],
        "Content-Type": "application/gzip"
    }

    return web.FileResponse(file_path, chunk_size=1024 * 1024, headers=headers)


@routes.get("/download/otus/{otu_id}/isolates/{isolate_id}")
async def download_isolate(req):
    """
    Download a FASTA file containing the sequences for a single Virtool isolate.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    try:
        filename, fasta = await virtool.downloads.db.generate_isolate_fasta(db, otu_id, isolate_id)
    except virtool.errors.DatabaseError as err:
        if "OTU does not exist" in str(err):
            return virtool.api.response.not_found("OTU not found")

        if "Isolate does not exist" in str(err):
            return virtool.api.response.not_found("Isolate not found")

        raise

    return web.Response(text=fasta, headers={
        "Content-Disposition": f"attachment; filename={filename}"
    })


@routes.get("/download/sequences/{sequence_id}")
async def download_sequence(req):
    """
    Download a FASTA file containing a single Virtool sequence.

    """
    db = req.app["db"]

    sequence_id = req.match_info["sequence_id"]

    try:
        filename, fasta = await virtool.downloads.db.generate_sequence_fasta(db, sequence_id)
    except virtool.errors.DatabaseError as err:
        if "Sequence does not exist" in str(err):
            return virtool.api.response.not_found("Sequence not found")

        if "Isolate does not exist" in str(err):
            return virtool.api.response.not_found("Isolate not found")

        if "OTU does not exist" in str(err):
            return virtool.api.response.not_found("OTU not found")

        raise

    if fasta is None:
        return web.Response(status=404)

    return web.Response(text=fasta, headers={
        "Content-Disposition": f"attachment; filename={filename}"
    })

