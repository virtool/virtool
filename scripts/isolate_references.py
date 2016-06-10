__author__ = 'igboyes'

import pymongo

VIRUSES = pymongo.MongoClient()["virtool-dev"]["viruses"]
SEQUENCES = pymongo.MongoClient()["virtool-dev"]["sequences"]

def test():
    for virus in VIRUSES.find():
        virus_id = virus["_id"]
        for isolate_index, isolate in enumerate(virus["isolates"]):
            for accession in isolate["sequences"]:
                print(str(virus_id) + "\t" + str(isolate_index) + "\t" + accession)
                SEQUENCES.update({"_id": accession}, {"$set": {
                    "virus": virus_id,
                    "isolate": isolate_index
                }})


