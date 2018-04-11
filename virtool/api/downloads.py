"""
Provides request handlers for file downloads.

"""
from aiohttp import web

import virtool.bio
import virtool.db.downloads
import virtool.kinds


async def download_sequence(req):
    db = req.app["db"]

    sequence_id = req.match_info["sequence_id"]

    fasta = await virtool.db.downloads.generate_sequence_fasta(db, sequence_id)

    if fasta is None:
        return web.Response(status=404)

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='{}.{}.{}.fa'".format(
            virus["name"].replace(" ", "_").lower(),
            isolate_name.replace(" ", "_").lower(),
            sequence_id.lower()
        )
    })


async def download_isolate_sequences(req):
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]
    isolate_id = req.match_info["isolate_id"]

    virus = await db.viruses.find_one({"_id": virus_id, "isolates.id": isolate_id}, ["name", "isolates"])

    if not virus:
        return web.Response(status=404)

    isolate = virtool.kinds.find_isolate(virus["isolates"], isolate_id)

    if isolate is None:
        return web.Response(status=404)

    isolate_name = virtool.kinds.format_isolate_name(isolate)

    fasta = list()

    async for sequence in db.sequences.find({"virus_id": virus_id, "isolate_id": isolate_id}, ["sequence"]):
        seq = sequence["sequence"]

        fasta.append(">{}|{}|{}|{}\n{}".format(virus["name"], isolate_name, sequence["_id"], len(seq), seq))

    fasta = "\n".join(fasta)

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='{}.{}.fa'".format(
            virus["name"].replace(" ", "_").lower(),
            isolate_name.replace(" ", "_").lower()
        )
    })


async def download_virus_sequences(req):
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    virus = await db.viruses.find_one(virus_id, ["name", "isolates"])

    if not virus:
        return web.Response(status=404)

    fasta = list()

    for isolate in virus["isolates"]:
        isolate_name = virtool.kinds.format_isolate_name(isolate)

        async for sequence in db.sequences.find({"isolate_id": isolate["id"]}, ["sequence"]):
            seq = sequence["sequence"]
            fasta.append(virtool.downloads.format_fasta_entry(
                virus["name"],
                isolate_name,
                sequence["_id"],
                seq
            ))

    fasta = "\n".join(fasta)

    return web.Response(text=fasta, headers={
        "Content-Disposition": "attachment; filename='{}.fa'".format(
            virus["name"].replace(" ", "_").lower()
        )
    })
