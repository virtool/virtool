"""
Provides request handlers for file downloads.

"""
import os
import gzip
import json

from aiohttp import web

import virtool.analyses.format
import virtool.api.json
import virtool.api.response
import virtool.bio
import virtool.analyses.db
import virtool.db.utils
import virtool.downloads.db
import virtool.history.db
import virtool.otus.db
import virtool.references.db
import virtool.errors
import virtool.http.routes
import virtool.otus.utils
import virtool.utils
import virtool.samples.utils

routes = virtool.http.routes.Routes()


@routes.get("/download/analyses/{analysis_id}.{extension}")
async def download_analysis(req):
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]
    extension = req.match_info["extension"]

    document = await db.analyses.find_one(analysis_id)

    if extension == "xlsx":
        formatted = await virtool.analyses.format.format_analysis_to_excel(req.app, document)

        headers = {
            "Content-Disposition": f"attachment; filename={analysis_id}.xlsx",
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }

        return web.Response(body=formatted, headers=headers)

    formatted = await virtool.analyses.format.format_analysis_to_csv(req.app, document)

    headers = {
        "Content-Disposition": f"attachment; filename={analysis_id}.csv",
        "Content-Type": "text/csv"
    }

    return web.Response(text=formatted, headers=headers)


@routes.get(r"/download/samples/{sample_id}/{prefix}_{suffix}.{extension:(fq|fastq|fq\.gz|fastq\.gz)}")
async def download_sample_reads(req):
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]
    extension = req.match_info["extension"]

    files = await virtool.db.utils.get_one_field(db.samples, "files", sample_id)

    if not files:
        return virtool.api.response.not_found()

    suffix = req.match_info["suffix"]
    sample_path = virtool.samples.utils.join_sample_path(req.app["settings"], sample_id)

    if extension == "fastq" or extension == "fq":
        path = virtool.samples.utils.join_legacy_read_path(sample_path, suffix)
    else:
        path = virtool.samples.utils.join_read_path(sample_path, suffix)

    if not os.path.isfile(path):
        return virtool.api.response.not_found()

    file_stats = virtool.utils.file_stats(path)

    headers = {
        "Content-Length": file_stats["size"],
        "Content-Type": "application/gzip"
    }

    return web.FileResponse(path, chunk_size=1024*1024, headers=headers)


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


@routes.get("/download/otus/{otu_id}")
async def download_otu(req):
    """
    Download a FASTA file containing the sequences for all isolates in a single Virtool otu.

    """
    db = req.app["db"]

    otu_id = req.match_info["otu_id"]

    try:
        filename, fasta = await virtool.downloads.db.generate_otu_fasta(db, otu_id)
    except virtool.errors.DatabaseError as err:
        if "Sequence does not exist" in str(err):
            return virtool.api.response.not_found("Sequence not found")

        if "OTU does not exist" in str(err):
            return virtool.api.response.not_found("OTU not found")

        raise

    if not fasta:
        return web.Response(status=404)

    return web.Response(text=fasta, headers={
        "Content-Disposition": f"attachment; filename={filename}"
    })


@routes.get("/download/indexes/{index_id}")
async def download_index_json(req):
    """
    Download a gzipped JSON file named ``reference.json.gz`` for a given index.

    """
    db = req.app["db"]
    index_id = req.match_info["index_id"]

    document = await db.indexes.find_one(index_id)
    ref_id = document["reference"]["id"]

    if "has_json" not in document or document["has_json"] is False:
        return virtool.api.response.not_found("Index JSON file not found")

    path = os.path.join(
        req.app["settings"]["data_path"],
        "references",
        ref_id,
        index_id,
        "reference.json.gz")

    return web.FileResponse(path, headers={
        "Content-Type": "application/gzip"
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
