import virtool.bio
import virtool.utils
import virtool.sample_analysis
from virtool.handlers.utils import not_found, json_response


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


async def blast_nuvs_sequence(req):
    """
    BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST data will be attached to that
    sequence.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]
    sequence_index = int(req.match_info["sequence_index"])

    analysis = await db.analyses.find_one({"_id": analysis_id}, ["results"])

    sequences = [result["sequence"] for result in analysis["results"] if result["index"] == int(sequence_index)]

    assert len(sequences) == 1

    sequence = sequences[0]

    rid, _ = await virtool.bio.initialize_ncbi_blast(sequence)

    ready = await virtool.bio.check_rid(rid)

    data = {
        "rid": rid,
        "ready": ready,
        "last_checked_at": virtool.utils.timestamp(),
        "interval": 3
    }

    await db.analyses.update_one({"_id": analysis_id, "results.index": sequence_index}, {
        "$set": {
            "results.$.blast": data
        }
    })

    wait_for_blast_coro = virtool.bio.wait_for_blast_result(
        db,
        req.app["dispatcher"].dispatch,
        analysis_id,
        sequence_index,
        rid
    )

    req.app.loop.create_task(wait_for_blast_coro)

    headers = {
        "Location": "/api/analyses/{}/{}/blast".format(analysis_id, sequence_index)
    }

    return json_response(data, status=201, headers=headers)
