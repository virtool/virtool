import asyncio

from virtool.handlers.utils import not_found, json_response
from virtool.sample_analysis import format_analysis


async def get(req):
    """
    Get a complete analysis document.
    
    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(analysis_id)

    formatted = await format_analysis(db, document)

    if document:
        return json_response(formatted)

    return not_found()


async def blast_nuvs_sequence(req):
    """
    BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST data will be attached to that
    sequence.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]
    sequence_index = req.match_info["sequence_index"]

    analysis = await req.app["db"].analyses.find_one({"_id": analysis_id}, ["sequences"])

    sequences = [sequence for sequence in analysis["sequences"] if sequence["index"] == int(sequence_index)]

    assert len(sequences) == 1

    nuc = sequences[0]["sequence"]

    rid, _ = await initialize_blast(nuc)

    ready = False
    checked = False
    interval = 3

    while not ready:
        await db.analyses.update_one({"_id": analysis_id, "sequences.index": sequence_index}, {
            "$set": {
                "sequences.$.blast": {
                    "rid": rid,
                    "ready": ready,
                    "checked": checked,
                    "interval": interval
                }
            }
        })

        asyncio.sleep(interval)

        ready = await check_rid(rid)

        interval += 3

    result = await retrieve_blast_result(rid)

    result.update({
        "rid": rid,
        "ready": ready,
        "checked": checked,
        "interval": interval
    })

    response = await db.analyses.update_one({"_id": analysis_id, "sequences.index": sequence_index}, {
        "$set": {
            "sequences.$.blast": result
        }
    })

    return True, response
