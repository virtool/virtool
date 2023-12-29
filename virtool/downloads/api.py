"""
Provides request handlers for file downloads.

"""
from aiohttp import web

from virtool.api.errors import APINotFound
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.api.routes import Routes

routes = Routes()


@routes.get("/download/otus/{otu_id}/isolates/{isolate_id}")
async def download_isolate(req):
    """
    Download a FASTA file containing the sequences for a single Virtool isolate.

    """

    otu_id = req.match_info["otu_id"]
    isolate_id = req.match_info["isolate_id"]

    try:
        filename, fasta = await get_data_from_req(req).otus.get_isolate_fasta(
            otu_id, isolate_id
        )
    except ResourceNotFoundError as err:
        if "OTU does not exist" in str(err):
            raise APINotFound("OTU not found")

        if "Isolate does not exist" in str(err):
            raise APINotFound("Isolate not found")

        raise

    return web.Response(
        text=fasta, headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@routes.get("/download/sequences/{sequence_id}")
async def download_sequence(req):
    """
    Download a FASTA file containing a single Virtool sequence.

    """

    sequence_id = req.match_info["sequence_id"]

    try:
        filename, fasta = await get_data_from_req(req).otus.get_sequence_fasta(
            sequence_id
        )
    except ResourceNotFoundError as err:
        if "Sequence does not exist" in str(err):
            raise APINotFound("Sequence not found")

        if "Isolate does not exist" in str(err):
            raise APINotFound("Isolate not found")

        if "OTU does not exist" in str(err):
            raise APINotFound("OTU not found")

        raise

    if fasta is None:
        return web.Response(status=404)

    return web.Response(
        text=fasta, headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
