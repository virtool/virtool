"""
Provides request handlers for file downloads.

"""
from aiohttp import web

import virtool.bio
import virtool.db.downloads
import virtool.errors
import virtool.http.routes
import virtool.kinds
from virtool.api.utils import not_found

routes = virtool.http.routes.Routes()


@routes.get("/download/kinds/{kind_id}/isolates/{isolate_id}")
async def download_isolate(req):
    """
    Download a FASTA file containing the sequences for a single Virtool isolate.

    """
    db = req.app["db"]

    kind_id = req.match_info["kind_id"]
    isolate_id = req.match_info["isolate_id"]

    try:
        filename, fasta = await virtool.db.downloads.generate_isolate_fasta(db, kind_id, isolate_id)
    except virtool.errors.DatabaseError as err:
        print(str(err))

        if "Kind does not exist" in str(err):
            return not_found("Kind does not exist")

        if "Isolate does not exist" in str(err):
            return not_found("Isolate does not exist")

        raise

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='{}'".format(filename)
    })


@routes.get("/download/kinds/{kind_id}")
async def download_kind(req):
    """
    Download a FASTA file containing the sequences for all isolates in a single Virtool kind.

    """
    db = req.app["db"]

    kind_id = req.match_info["kind_id"]

    try:
        filename, fasta = await virtool.db.downloads.generate_kind_fasta(db, kind_id)
    except virtool.errors.DatabaseError as err:
        if "Sequence does not exist" in str(err):
            return not_found("Sequence does not exist")

        if "Kind does not exist" in str(err):
            return not_found("Kind does not exist")

        raise

    if not fasta:
        return web.Response(status=404)

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='{}'".format(filename)
    })


@routes.get("/download/sequences/{sequence_id}")
async def download_sequence(req):
    """
    Download a FASTA file containing a single Virtool sequence.

    """
    db = req.app["db"]

    sequence_id = req.match_info["sequence_id"]

    try:
        filename, fasta = await virtool.db.downloads.generate_sequence_fasta(db, sequence_id)
    except virtool.errors.DatabaseError as err:
        if "Sequence does not exist" in str(err):
            return not_found("Sequence does not exist")

        if "Isolate does not exist" in str(err):
            return not_found("Isolate does not exist")

        if "Kind does not exist" in str(err):
            return not_found("Kind does not exist")

        raise

    if fasta is None:
        return web.Response(status=404)

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='{}'".format(filename)
    })
