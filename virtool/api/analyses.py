"""
Provides request handlers for managing and viewing analyses.

"""
import asyncio
import json
import os

import aiofiles

import virtool.bio
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

        if document["algorithm"] == "nuvs" and document["results"] == "file":

            sample_id = document["sample"]["id"]

            path = os.path.join(
                req.app["settings"].get("data_path"),
                "samples",
                sample_id,
                "analysis",
                analysis_id,
                "nuvs.json"
            )

            async with aiofiles.open(path, "r") as f:
                json_string = await f.read()
                document["results"] = json.loads(json_string)

        document = await virtool.jobs.analysis.format_analysis(db, document)

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

    analysis_id = req.match_info["analysis_id"]
    sequence_index = int(req.match_info["sequence_index"])

    analysis = await db.analyses.find_one({"_id": analysis_id}, ["ready", "algorithm", "results"])

    if not analysis:
        return not_found("Analysis not found")

    if analysis["algorithm"] != "nuvs":
        return bad_request("Not a NuVs analysis")

    if not analysis["ready"]:
        return conflict("Analysis is still running")

    sequences = [result["sequence"] for result in analysis["results"] if result["index"] == int(sequence_index)]

    # Empty sequences list means sequence was not found.
    if not sequences:
        return not_found("Sequence not found")

    # Raise exception if more than one sequence has the provided index. This should never happen, just being careful.
    if len(sequences) > 1:
        raise ValueError("More than one sequence with index {}".format(sequence_index))

    # Start a BLAST at NCBI with the specified sequence. Return a RID that identifies the BLAST run.
    rid, _ = await virtool.bio.initialize_ncbi_blast(req.app["settings"], sequences[0])

    # Do initial check of RID to populate BLAST embedded document.
    data = {
        "rid": rid,
        "ready": await virtool.bio.check_rid(req.app["settings"], rid),
        "last_checked_at": virtool.utils.timestamp(),
        "interval": 3
    }

    document = await db.analyses.find_one_and_update({"_id": analysis_id, "results.index": sequence_index}, {
        "$set": {
            "results.$.blast": data
        }
    })

    formatted = await virtool.jobs.analysis.format_analysis(db, document)

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

    return json_response(data, headers=headers, status=200)
