import pymongo
import pydash

database = pymongo.MongoClient()["virtool-3"]


for virus in database.viruses.find():
    default_isolate = pydash.find_where(virus["isolates"], {"default": True})

    for sequence in database.sequences.find({"isolate_id": default_isolate["isolate_id"]}):
        header = "|".join([">", virus["name"], sequence["_id"], sequence["definition"]])
        print(header)
        print(sequence["sequence"])