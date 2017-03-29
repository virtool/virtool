import os
import gzip
import json
import math
import shutil

from aiohttp import web
from pymongo import ReturnDocument
from collections import Counter
from virtool import hmm
from virtool.data_utils import get_new_id
from virtool.handler_utils import unpack_json_request


async def find(req):
    documents = await req.app["db"].hmm.find({}).to_list(length=10)
    return web.json_response(documents, status=200)


async def get(req):
    document = await req.app["db"].find_one({"_id": req.match_info["hmm_id"]})

    if document:
        return web.json_response(hmm.to_client(document))

    return web.json_response({"message": "Not found"}, status=404)


async def update(req):
    db, data = await unpack_json_request(req)

    if len(data) != 1 or "label" not in data:
        return web.json_response({"Invalid input"}, status=400)

    hmm_id = req.match_info["hmm_id"]

    if not await db.hmm.find({"_id": hmm_id}).count():
        return web.json_response({"Not found"}, status=404)

    document = await db.hmm.find_one_and_update({"_id": hmm_id}, {
        "$set": data
    }, projection=hmm.projection, return_document=ReturnDocument.AFTER)

    return web.json_response(document)


async def check(req):
    result = await hmm.check(req.app["db"], req.app["settings"])
    return web.json_response(result)


async def clean(req):
    db = req.app["db"]
    settings = req.app["settings"]

    errors = await hmm.check(db, settings)

    if errors["not_in_file"]:
        hmm_ids = await db.hmm.find({"cluster": {
            "$in": errors["not_in_file"]
        }}).distinct("_id")

        await db.hmm.remove({"_id": {"$in": hmm_ids}})

        return web.json_response(await hmm.check(db, settings))

    return web.json_response({"No problems found"}, status=404)


async def import_hmm(req):
    db, data = unpack_json_request(req)

    settings = req.app["settings"]

    src_path = os.path.join(settings.get("data_path"), "files", data["file_id"])
    dest_path = os.path.join(settings.get("data_path"), "hmm/profiles.hmm")

    shutil.copyfile(src_path, dest_path)

    result = await hmm.check(db, settings)

    await db.status.update("hmm", {
        "$set": result
    }, upsert=True)

    return web.json_response(result)


async def import_annotations(req):
    db, data = unpack_json_request(req)

    settings = req.app["settings"]

    if await db.hmm.count():
        return web.json_response({"message": "Annotations collection is not empty"}, status=400)

    with gzip.open(os.path.join(settings.get("data_path"), "files", data["file_id"]), "rt") as input_file:
        annotations_to_import = json.load(input_file)

    # The number of annotation documents that will be imported.
    count = len(annotations_to_import)

    # transaction.update({"count": count})

    # The number of documents to insert at a time.
    chunk_size = int(math.ceil(count * 0.03))

    # A list of documents that have to be inserted when chunk_size is met.
    cache = list()

    for i, annotation in enumerate(annotations_to_import):
        top_three = Counter([entry["name"] for entry in annotation["entries"]]).most_common(3)
        top_names = [entry[0] for entry in top_three]

        new_id = await get_new_id(db.hmm)

        annotation.update({
            "_id": new_id,
            "definition": top_names,
            "label": top_names[0],
            "_version": 0
        })

        cache.append(annotation)

        '''
        if len(cache) == chunk_size or i == count - 1:
            self.db.insert_many(cache)
            yield self.dispatch("update", [{key: d[key] for key in self.sync_projector} for d in cache])
            cache = []
        '''

    # transaction.update({"checking": True})

    return web.json_response(await hmm.check(db, settings))
