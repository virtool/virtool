"""
Provides request handlers for file downloads.

"""
from aiohttp import web

from virtool.api.response import NotFound
from virtool.downloads.db import generate_isolate_fasta, generate_sequence_fasta
from virtool.errors import DatabaseError
from virtool.http.routes import Routes

routes = Routes()


@routes.get("/download/otus/{otu_id}/isolates/{isolate_id}")
async def download_isolate(req):
    """
    Download a FASTA file containing the sequences for a single Virtool isolate.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    try:
        filename, fasta = await generate_isolate_fasta(db, otu_id, isolate_id)
    except DatabaseError as err:
        if "OTU does not exist" in str(err):
            raise NotFound("OTU not found")

        if "Isolate does not exist" in str(err):
            raise NotFound("Isolate not found")

        raise

    return web.Response(
        text=fasta, headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@routes.get("/download/sequences/{sequence_id}")
async def download_sequence(req):
    """
    Download a FASTA file containing a single Virtool sequence.

    """
    db = req.app["db"]

    sequence_id = req.match_info["sequence_id"]

    try:
        filename, fasta = await generate_sequence_fasta(db, sequence_id)
    except DatabaseError as err:
        if "Sequence does not exist" in str(err):
            raise NotFound("Sequence not found")

        if "Isolate does not exist" in str(err):
            raise NotFound("Isolate not found")

        if "OTU does not exist" in str(err):
            raise NotFound("OTU not found")

        raise

    if fasta is None:
        return web.Response(status=404)

    return web.Response(
        text=fasta, headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
