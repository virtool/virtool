import asyncio

from aiohttp import web
from virtool.data.samples import recalculate_algorithm_tags
from virtool.data.analyses import format_analyses, remove_by_id, initialize_blast, check_rid, retrieve_blast_result


async def get_analysis(req):
    """
    Get a complete analysis document.
    
    """
    analysis_id = req.match_info["analysis_id"]

    document = await req["db"].find_one(analysis_id)

    if document:
        return web.json_response(await format_analyses(document))

    return web.json_response({"message": "Not found"}, status=404)


async def blast_nuvs_sequence(req):
    """
    BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST data will be attached to that
    sequence.

    """
    analysis_id = req.match_info["analysis_id"]
    sequence_index = req.match_info["sequence_index"]

    analysis = await req["db"].analyses.find_one({"_id": analysis_id}, ["sample_id", "sequences"])

    sequences = [sequence for sequence in analysis["sequences"] if sequence["index"] == int(sequence_index)]

    assert len(sequences) == 1

    nuc = sequences[0]["sequence"]

    rid, _ = await initialize_blast(nuc)

    ready = False
    checked = False
    interval = 3

    while not ready:
        await req["db"].analyses.update({"_id": analysis_id, "sequences.index": sequence_index}, {
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

    response = await req["db"].analyses.update({"_id": analysis_id, "sequences.index": sequence_index}, {
        "$set": {
            "sequences.$.blast": result
        }
    })

    return True, response


async def remove_analysis(req):
    """
    Remove an analysis document

    """
    analysis_id = req.match_info["analysis_id"]

    document = await req["db"].analyses.find_one({"_id": analysis_id}, ["sample_id"])

    await recalculate_algorithm_tags(req["db"], document["sample_id"])

    await remove_by_id(req["db"], analysis_id)
