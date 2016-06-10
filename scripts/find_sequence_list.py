import pymongo

collection = pymongo.MongoClient()["virtool-3"]["sequences"]

for entry in collection.find():
    if entry["sequence"] is None:
        print(entry)

    if entry["_id"] is None:
        print(entry)
        # collection.update({"_id": entry["_id"]}, {"$set": {"sequence": "".join(entry["sequence"])}})
