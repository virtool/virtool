"""
Provides request handlers for managing and viewing analyses.

"""
import asyncio

import virtool.analyses
import virtool.bio
import virtool.db.analyses
import virtool.errors
import virtool.jobs.analysis
import virtool.samples
import virtool.utils
from virtool.api.utils import bad_request, conflict, insufficient_rights, json_response, no_content, not_found


async def get(req):
    """
    Get a complete analysis document.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(analysis_id)

    if document is None:
        return not_found()

    if document["ready"]:
        document = await virtool.db.analyses.format_analysis(db, req.app["settings"], document)

    return json_response(virtool.utils.base_processor(document))


async def remove(req):
    """
    Remove an analysis document by its id.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one({"_id": analysis_id}, ["job", "ready", "sample"])

    if not document:
        return not_found()

    sample = await db.samples.find_one({"_id": document["sample"]["id"]}, virtool.samples.PROJECTION)

    if not sample:
        return not_found("Sample not found")

    read, write = virtool.samples.get_sample_rights(sample, req["client"])

    if not read or not write:
        return insufficient_rights()

    if not document["ready"]:
        return conflict("Analysis is still running")

    await req.app["dispatcher"].dispatch("samples", "update", virtool.utils.base_processor(sample))

    return no_content()


async def blast(req):
    """
    BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST data will be attached to that
    sequence.

    """
    db = req.app["db"]
    settings = req.app["settings"]

    analysis_id = req.match_info["analysis_id"]
    sequence_index = int(req.match_info["sequence_index"])

    document = await db.analyses.find_one({"_id": analysis_id}, ["ready", "algorithm", "results"])

    if not document:
        return not_found("Analysis not found")

    if document["algorithm"] != "nuvs":
        return bad_request("Not a NuVs analysis")

    if not document["ready"]:
        return conflict("Analysis is still running")

    sequence = virtool.analyses.get_nuvs_sequence_by_index(document, sequence_index)

    if sequence is None:
        return not_found("Sequence not found")

    # Start a BLAST at NCBI with the specified sequence. Return a RID that identifies the BLAST run.
    rid, _ = await virtool.bio.initialize_ncbi_blast(req.app["settings"], sequence)

    blast_data, document = await virtool.db.analyses.update_nuvs_blast(db, settings, analysis_id, sequence_index, rid)

    formatted = await virtool.db.analyses.format_analysis(db, settings, document)

    await req.app["dispatcher"].dispatch("analyses", "update", virtool.utils.base_processor(formatted))

    # Wait on BLAST request as a Task until the it completes on NCBI. At that point the sequence in the DB will be
    # updated with the BLAST result.
    asyncio.ensure_future(virtool.bio.wait_for_blast_result(
        db,
        req.app["settings"],
        req.app["dispatcher"].dispatch,
        analysis_id,
        sequence_index,
        rid
    ), loop=req.app.loop)

    headers = {
        "Location": "/api/analyses/{}/{}/blast".format(analysis_id, sequence_index)
    }

    return json_response(blast_data, headers=headers, status=200)
