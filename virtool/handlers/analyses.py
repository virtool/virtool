import asyncio

import virtool.bio
import virtool.utils
import virtool.sample
import virtool.sample_analysis
from virtool.handlers.utils import bad_request, conflict, json_response, no_content, not_found


async def get(req):
    """
    Get a complete analysis document.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(analysis_id)

    formatted = await virtool.sample_analysis.format_analysis(db, document)

    if document:
        return json_response(virtool.utils.base_processor(formatted))

    return not_found()


async def remove(req):
    """
    Remove an analysis document by its id.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one({"_id": analysis_id}, ["ready", "job"])

    if not document:
        return not_found()

    if not document["ready"]:
        return conflict("Analysis is still running. Cancel job '{}' instead".format(document["job"]["id"]))

    document = await db.analyses.find_one_and_delete({"_id": analysis_id}, ["sample"])

    sample_id = document["sample"]["id"]

    sample = await db.samples.find_one({"_id": sample_id}, virtool.sample.PROJECTION)

    if sample:
        await req.app["dispatcher"].dispatch("samples", "update", virtool.utils.base_processor(sample))

    return no_content()


async def blast(req):
    """
    BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST data will be attached to that
    sequence.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]
    sequence_index = int(req.match_info["sequence_index"])

    analysis = await db.analyses.find_one({"_id": analysis_id}, ["ready", "algorithm", "results"])

    if not analysis:
        return not_found("Analysis not found")

    if analysis["algorithm"] != "nuvs":
        return bad_request("Not a NuVs analysis")

    if not analysis["ready"]:
        return bad_request("Still in progress")

    sequences = [result["sequence"] for result in analysis["results"] if result["index"] == int(sequence_index)]

    # Empty sequences list means sequence was not found.
    if not sequences:
        return not_found("Sequence not found")

    # Raise exception if more than one sequence has the provided index. This should never happen, just being careful.
    if len(sequences) > 1:
        raise ValueError("More than one sequence with index {} found".format(sequence_index))

    # Start a BLAST at NCBI with the specified sequence. Return a RID that identifies the BLAST run.
    rid, _ = await virtool.bio.initialize_ncbi_blast(sequences[0])

    # Do initial check of RID to populate BLAST embedded document.
    data = {
        "rid": rid,
        "ready": await virtool.bio.check_rid(rid),
        "last_checked_at": virtool.utils.timestamp(),
        "interval": 3
    }

    document = await db.analyses.find_one_and_update({"_id": analysis_id, "results.index": sequence_index}, {
        "$set": {
            "results.$.blast": data
        }
    })

    formatted = await virtool.sample_analysis.format_analysis(db, document)

    await req.app["dispatcher"].dispatch("analyses", "update", virtool.utils.base_processor(formatted))

    # Wait on BLAST request as a Task until the it completes on NCBI. At that point the sequence in the DB will be
    # updated with the BLAST result.
    asyncio.ensure_future(virtool.bio.wait_for_blast_result(
        db,
        req.app["dispatcher"].dispatch,
        analysis_id,
        sequence_index,
        rid
    ), loop=req.app.loop)

    headers = {
        "Location": "/api/analyses/{}/{}/blast".format(analysis_id, sequence_index)
    }

    return json_response(data, status=200, headers=headers)
