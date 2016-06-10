import pymongo

database = pymongo.MongoClient()["virtool-dev"]

for virus in database.viruses.find():
    counts = set()

    for isolate in virus["isolates"]:
        counts.add(database.sequences.find({"isolate_id": isolate["isolate_id"]}).count())

    if len(counts) > 1:
        print("Found: " + virus["name"])