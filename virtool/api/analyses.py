"""
Provides request handlers for managing and viewing analyses.

"""
import os
import aiojobs.aiohttp

import virtool.analyses
import virtool.bio
import virtool.db.analyses
import virtool.db.samples
import virtool.errors
import virtool.http.routes
import virtool.samples
import virtool.utils
from virtool.api.utils import bad_request, conflict, insufficient_rights, json_response, no_content, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/analyses/{analysis_id}")
async def get(req):
    """
    Get a complete analysis document.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(analysis_id)

    if document is None:
        return not_found()

    sample = await db.samples.find_one({"_id": document["sample"]["id"]}, virtool.db.samples.PROJECTION)

    if not sample:
        return bad_request("Parent sample does not exist")

    read, _ = virtool.samples.get_sample_rights(sample, req["client"])

    if not read:
        return insufficient_rights()

    if document["ready"]:
        document = await virtool.db.analyses.format_analysis(db, req.app["settings"], document)

    return json_response(virtool.utils.base_processor(document))


@routes.delete("/api/analyses/{analysis_id}")
async def remove(req):
    """
    Remove an analysis document by its id.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one({"_id": analysis_id}, ["job", "ready", "sample"])

    if not document:
        return not_found()

    sample_id = document["sample"]["id"]

    sample = await db.samples.find_one({"_id": sample_id}, virtool.db.samples.PROJECTION)

    if not sample:
        return bad_request("Parent sample does not exist")

    read, write = virtool.samples.get_sample_rights(sample, req["client"])

    if not read or not write:
        return insufficient_rights()

    if not document["ready"]:
        return conflict("Analysis is still running")

    await db.analyses.delete_one({"_id": analysis_id})

    path = os.path.join(req.app["settings"]["data_path"], "samples", sample_id, "analysis", analysis_id)

    await req.app["run_in_thread"](virtool.utils.rm, path, True)

    await virtool.db.samples.recalculate_algorithm_tags(db, sample_id)

    return no_content()


@routes.put("/api/analyses/{analysis_id}/{sequence_index}/blast")
async def blast(req):
    """
    BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST data will be attached to that
    sequence.

    """
    db = req.app["db"]
    settings = req.app["settings"]

    analysis_id = req.match_info["analysis_id"]
    sequence_index = int(req.match_info["sequence_index"])

    document = await db.analyses.find_one({"_id": analysis_id}, ["ready", "algorithm", "results", "sample"])

    if not document:
        return not_found("Analysis not found")

    if document["algorithm"] != "nuvs":
        return conflict("Not a NuVs analysis")

    if not document["ready"]:
        return conflict("Analysis is still running")

    sequence = virtool.analyses.get_nuvs_sequence_by_index(document, sequence_index)

    if sequence is None:
        return not_found("Sequence not found")

    sample = await db.samples.find_one({"_id": document["sample"]["id"]}, virtool.db.samples.PROJECTION)

    if not sample:
        return bad_request("Parent sample does not exist")

    _, write = virtool.samples.get_sample_rights(sample, req["client"])

    if not write:
        return insufficient_rights()

    # Start a BLAST at NCBI with the specified sequence. Return a RID that identifies the BLAST run.
    rid, _ = await virtool.bio.initialize_ncbi_blast(req.app["settings"], sequence)

    blast_data, document = await virtool.db.analyses.update_nuvs_blast(db, settings, analysis_id, sequence_index, rid)

    # Wait on BLAST request as a Task until the it completes on NCBI. At that point the sequence in the DB will be
    # updated with the BLAST result.
    await aiojobs.aiohttp.spawn(req, virtool.bio.wait_for_blast_result(
        db,
        req.app["settings"],
        analysis_id,
        sequence_index,
        rid
    ))

    headers = {
        "Location": f"/api/analyses/{analysis_id}/{sequence_index}/blast"
    }

    return json_response(blast_data, headers=headers, status=201)
