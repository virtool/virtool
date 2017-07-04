import os
import gzip
import json
import shutil
from collections import Counter
from pymongo import ReturnDocument

import virtool.utils
import virtool.virus_hmm
from virtool.handlers.utils import unpack_json_request, json_response, not_found, validation, protected


async def find(req):
    """
    Find HMM annotation documents.
     
    """
    documents = await req.app["db"].hmm.find({}, projection=virtool.virus_hmm.projection).to_list(length=10)

    return json_response([virtool.utils.base_processor(d) for d in documents])


async def get(req):
    """
    Get a complete individual HMM annotation document.
     
    """
    document = await req.app["db"].hmm.find_one({"_id": req.match_info["hmm_id"]})

    if document:
        return json_response(virtool.utils.base_processor(document))

    return not_found()


@protected("modify_hmm")
@validation({"label": {"type": "string", "required": True}})
async def update(req):
    """
    Update the label field for an HMM annotation document.
    
    """
    db, data = req.app["db"], req["data"]

    hmm_id = req.match_info["hmm_id"]

    if not await db.hmm.find({"_id": hmm_id}).count():
        return not_found()

    document = await db.hmm.find_one_and_update({"_id": hmm_id}, {
        "$set": data
    }, return_document=ReturnDocument.AFTER)

    return json_response(virtool.utils.base_processor(document))


async def check(req):
    result = await virtool.virus_hmm.check(req.app["db"], req.app["settings"])
    return json_response(result)


async def clean(req):
    db = req.app["db"]
    settings = req.app["settings"]

    errors = await virtool.virus_hmm.check(db, settings)

    if errors["not_in_file"]:
        hmm_ids = await db.hmm.find({"cluster": {
            "$in": errors["not_in_file"]
        }}).distinct("_id")

        await db.hmm.delete_many({"_id": {"$in": hmm_ids}})

        return json_response(await virtool.virus_hmm.check(db, settings))

    return json_response({"No problems found"}, status=404)


async def import_hmm(req):
    db, data = unpack_json_request(req)

    settings = req.app["settings"]

    src_path = os.path.join(settings.get("data_path"), "files", data["file_id"])
    dest_path = os.path.join(settings.get("data_path"), "hmm/profiles.hmm")

    shutil.copyfile(src_path, dest_path)

    result = await virtool.virus_hmm.check(db, settings)

    await db.status.update_one("hmm", {
        "$set": result
    }, upsert=True)

    return json_response(result)


async def import_annotations(req):
    db, data = unpack_json_request(req)

    settings = req.app["settings"]

    if await db.hmm.count():
        return json_response({"message": "Annotations collection is not empty"}, status=400)

    with gzip.open(os.path.join(settings.get("data_path"), "files", data["file_id"]), "rt") as input_file:
        annotations_to_import = json.load(input_file)

    # A list of documents that have to be inserted when chunk_size is met.
    cache = list()

    for i, annotation in enumerate(annotations_to_import):
        top_three = Counter([entry["name"] for entry in annotation["entries"]]).most_common(3)
        top_names = [entry[0] for entry in top_three]

        new_id = await virtool.utils.get_new_id(db.hmm)

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

    return json_response(await virtool.virus_hmm.check(db, settings))
