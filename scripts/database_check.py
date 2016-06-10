import pymongo
import datetime

database = pymongo.MongoClient()["virtool-3"]

def human_time():
    return datetime.datetime.now().strftime("%b %d %Y %H:%M:%S")

def log(message):
    print(human_time() + " " + message)

def get_permission(message):
    while True:
        typed = input(message + "[Y/n]")

        if typed in ["Y", "n", "N"]:
            return typed == "Y"

viruses = [virus for virus in database["viruses"].find()]

print(str(len(viruses)) + " viruses\n")

isolates = list()
duplicates = set()

for virus in viruses:
    for isolate in virus["isolates"]:
        if isolate["isolate_id"] in isolates:
            duplicates.add(isolate["isolate_id"])
        else:
            isolates.append(isolate["isolate_id"])

print(str(len(isolates)) + " unique isolates")
print(str(len(duplicates)) + " duplicate isolates")

sequences = [sequence for sequence in database["sequences"].find()]

print("\n" + str(len(sequences)) + " sequences")

non_referenced_isolate_ids = list()

for sequence in sequences:
    try:
        if sequence["isolate_id"] not in isolates:
            print("\nFound sequence with invalid isolate_id: ")
            sequence["sequence"] = len(sequence["sequence"])
            print(sequence)

            if get_permission("Delete this sequence?"):
                database["sequences"].remove({"_id": sequence["_id"]})

            print("\n" + str(database["sequences"].count()) + " sequences")

    except KeyError:
        print("Found sequence with unset isolate_id: ")
        print(sequence)
        if get_permission("Delete this sequence?"):
            database["sequences"].remove({"_id": sequence["_id"]})

print(str(len(non_referenced_isolate_ids)) + " sequences without valid isolates")