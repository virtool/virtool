"""
Request handlers for file downloads.

"""
from aiohttp import web

async def download_sequence(req):
    db = req.app["db"]

    sequence_id = req.match_info["sequence_id"]

    document = await db.sequences.find_one(sequence_id, ["sequence"])

    if document is None:
        return web.Response(status=404)

    fasta = ">{}\n{}".format(sequence_id, document["sequence"])

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='seq_{}.fa'".format(sequence_id)
    })


async def download_isolate_sequences(req):
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]
    isolate_id = req.match_info["isolate_id"]

    if not await db.viruses.count({"_id": virus_id, "isolates.id": isolate_id}):
        return web.Response(status=404)

    fasta = list()

    async for document in db.sequences.find({"virus_id": virus_id, "isolate_id": isolate_id}, ["sequence"]):
        fasta += [
            ">{}".format(document["_id"]),
            document["sequence"]
        ]

    fasta = "\n".join(fasta)

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='isolate_{}.fa'".format(isolate_id)
    })
