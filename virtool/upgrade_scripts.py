import pymongo


db = pymongo.MongoClient()["virtool"]


names = dict()
updates = list()


for document in db.history.find({}, ["virus_id"]):
    change_id = document["_id"]
    virus_id = document["virus_id"]

    if virus_id in names:
        updates.append((change_id, names[virus_id]))
        continue

    virus_name = db.viruses.find_one(virus_id)["name"]

    assert virus_name

    updates.append((change_id, virus_name))
    names[virus_id] = virus_name


for change_id, virus_name in updates:
    db.history.update({"_id": change_id}, {
        "$set": {
            "virus_name": virus_name
        }
    })
