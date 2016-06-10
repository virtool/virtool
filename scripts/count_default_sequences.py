import pymongo

database = pymongo.MongoClient()["virtool-dev"]

sequence_count = 0

for virus in database.viruses.find():
    isolate_id = virus["isolates"][0]["isolate_id"]
    sequence_count += database.sequences.find({"isolate_id": isolate_id}).count()

print(sequence_count)