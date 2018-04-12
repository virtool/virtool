"""
Provides request handlers for file downloads.

"""
from aiohttp import web

import virtool.bio
import virtool.db.downloads
import virtool.kinds


async def download_isolate(req):
    """
    Download a FASTA file containing the sequences for a single Virtool isolate.

    """
    db = req.app["db"]

    kind_id = req.match_info["kind_id"]
    isolate_id = req.match_info["isolate_id"]

    filename, fasta = await virtool.db.downloads.generate_isolate_fasta(db, kind_id, isolate_id)

    if fasta is None:
        return web.Response(status=404)

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='{}'".format(filename)
    })


async def download_kind(req):
    """
    Download a FASTA file containing the sequences for all isolates in a single Virtool kind.

    """
    db = req.app["db"]

    kind_id = req.match_info["kind_id"]

    filename, fasta = await virtool.db.downloads.generate_isolate_fasta(db, kind_id)

    if not fasta:
        return web.Response(status=404)

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='{}'".format(filename)
    })


async def download_sequence(req):
    """
    Download a FASTA file containing a single Virtool sequence.

    """
    db = req.app["db"]

    sequence_id = req.match_info["sequence_id"]

    filename, fasta = await virtool.db.downloads.generate_sequence_fasta(db, sequence_id)

    if fasta is None:
        return web.Response(status=404)

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='{}'".format(filename)
    })
