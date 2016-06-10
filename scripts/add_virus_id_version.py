import pymongo

database = pymongo.MongoClient()["virtool-3"]

updates = []

for analysis in database["analyses"].find():
    for accession, hit in analysis["diagnosis"].items():
        minimal_sequence = database["sequences"].find_one({"_id": accession}, {"isolate_id": True})

        minimal_virus = database["viruses"].find_one({"isolates.isolate_id": minimal_sequence["isolate_id"]})

        hit["virus_id"] = minimal_virus["_id"]
        hit["virus_version"] = minimal_virus["_version"]

    updates.append(analysis)

for update in updates:
    database["analyses"].update({"_id": update["_id"]}, update)