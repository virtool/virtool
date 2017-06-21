import os
import subprocess

from virtool.user_permissions import PERMISSIONS
from virtool.user_groups import merge_group_permissions
from virtool.virus import get_default_isolate
from virtool.virus import merge_virus
from virtool.sample import calculate_algorithm_tags


async def rename_username_to_user_id(collection):
    await collection.update_many({"username": {"$exists": ""}}, {
        "$rename": {
            "username": "user_id"
        }
    })


async def unset_version_field(collection):
    await collection.update_many({"_version": {"$exists": ""}}, {
        "$unset": {
            "_version": ""
        }
    })


async def organize_subtraction(db):
    collection_names = await db.collection_names()

    if "hosts" in collection_names and "subtraction" not in collection_names:
        # Get all documents from the hosts collection.
        documents = await db.hosts.find().to_list(None)

        for document in documents:
            document["is_host"] = True

        # Copy the documents to a new subtraction collection.
        await db.subtraction.insert_many(documents)

        # Remove the old hosts collection
        await db.drop_collection("hosts")

    await rename_username_to_user_id(db.hosts)
    await unset_version_field(db.hosts)


def organize_analyses(database):

    # Make sure all NuVs analysis records reference HMMs in the database rather than storing the HMM data
    # themselves. Only do this if HMM records are defined in the database.
    if database.hmm.count() > 0:

        for analysis in database.analyses.find({"algorithm": "nuvs"}):
            # If the definition key is defined, the record is storing the information for each HMM and must be
            # updated.
            if "definition" in analysis["hmm"][0]:

                hits = analysis["hmm"]

                # Fix up the HMM hit entries for the analysis.
                for hit in hits:
                    # Get the database id for the HMM the hit should be linked to.
                    cluster = int(hit["hit"].split("_")[1])
                    hmm = database.hmm.find_one({"cluster": cluster}, {"_id": True})

                    # Get rid of the unnecessary fields.
                    hit.pop("definition")
                    hit.pop("families")

                    # Change the hit field rto the id for the HMM record instead of vFam_###.
                    hit["hit"] = hmm["_id"]

                # Commit the new hit entries to the database.
                database.analyses.update({"_id": analysis["_id"]}, {
                    "$set": {
                        "hmm": hits
                    }
                })

    database.analyses.update({"comments": {"$exists": True}}, {
        "$rename": {
            "comments": "name"
        }
    }, multi=True)

    database.analyses.update({"discovery": {"$exists": True}}, {
        "$unset": {
            "discovery": ""
        }
    }, multi=True)

    database.analyses.update({"_version": {"$exists": False}}, {
        "$set": {
            "_version": 0
        }
    }, multi=True)

    database.analyses.update({"sample": {"$exists": True}}, {
        "$rename": {
            "sample": "sample_id"
        }
    })

    database.analyses.update({"algorithm": {"$exists": False}}, {
        "$set": {
            "algorithm": "pathoscope_bowtie"
        }
    }, multi=True)

    database.analyses.remove({"ready": False})


def get_bowtie2_index_names(index_path):
    """
    Get the headers of all the FASTA sequences used to build the Bowtie2 index in *index_path*.
    *Requires Bowtie2 in path.*

    :param index_path: the patch to the Bowtie2 index.
    :return: list of FASTA headers.
    """
    try:
        inspect = subprocess.check_output(["bowtie2-inspect", "-n", index_path], stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None

    inspect_list = str(inspect, "utf-8").split("\n")
    inspect_list.remove("")

    return inspect_list


def extract_sequence_ids(joined_virus):
    """
    Get the ids of all sequences in a joined virus.

    :param joined_virus: a joined virus comprising the virus document and its associated sequences.
    :return: a list of sequence ids.

    """
    sequence_ids = list()

    for isolate in joined_virus["isolates"]:
        for sequence in isolate["sequences"]:
            sequence_ids.append(sequence["_id"])

    return sequence_ids


def organize_viruses(database):
    database.viruses.update({}, {
        "$unset": {
            "segments": "",
            "abbrevation": "",
            "new": ""
        }
    }, multi=True)

    indexes_path = os.path.join(data_path, "reference/viruses/")

    response = {
        "missing_index": False,
        "mismatched_index": False,
        "missing_history": list(),
        "missing_recent_history": list(),
        "orphaned_analyses": os.listdir(indexes_path)
    }

    ref_names = None

    # Get the entry describing the most recently built (active) index from the DB.
    try:
        active_index = database.indexes.find({"ready": True}).sort("index_version", -1)[0]
    except IndexError:
        active_index = None

    # Check that there is an active index.
    if active_index:
        active_index_path = os.path.join(indexes_path, active_index["_id"])

        # Set missing index to True if we can find the directory for the active index on disk.
        response["missing_index"] = not os.path.exists(active_index_path)

        # This key-value is initially a list of all indexes on disk. Remove the index_id of the active index.
        try:
            response["orphaned_analyses"].remove(active_index["_id"])
        except ValueError:
            pass

        # Get the FASTA headers of all the sequences used to build the reference.
        ref_names = get_bowtie2_index_names(os.path.join(active_index_path, "reference"))

    sequence_ids = list()

    for virus in database.viruses.find({}):
        default_isolate = get_default_isolate(virus)

        sequences = list(database.sequences.find({"isolate_id": default_isolate["isolate_id"]}))

        patched_and_joined = merge_virus(virus, sequences)

        if virus["_version"] > 0:
            # Get all history entries associated with the virus entry.
            history = list(db.history.find({"entry_id": virus["_id"]}).sort("entry_version", -1))

            # If this tests true, the virus has a greater version number than can be accounted for by the history. This
            # is not a fatal problem.
            if virus["_version"] > len(history):
                response["missing_history"].append(virus["_id"])

            # If the virus entry version is higher than the last_indexed_version, check that the unbuilt changes are
            # stored in history. Also patch the virus back to its last_index_version state and store in patched_viruses.
            if virus["last_indexed_version"] != virus["_version"]:
                # The number of virus entry versions between the current version and the last_indexed_version.
                required_unbuilt_change_count = int(virus["_version"] - virus["last_indexed_version"])

                # Count the number of history entries containing unbuilt changes for this virus.
                recent_history = [doc for doc in history if doc["index_version"] == "unbuilt"]

                # The two previously assigned variables must be equal. Otherwise the virus_id will be added to the
                # missing_recent_history list in the response dict returned by this function.
                if required_unbuilt_change_count != len(recent_history):
                    response["missing_recent_history"].append(virus["_id"])

                _, patched_and_joined, _ = virus(patched_and_joined, recent_history)

        sequence_ids += extract_sequence_ids(patched_and_joined)

    sequence_id_set = set(sequence_ids)

    response["duplicate_sequence_ids"] = len(sequence_id_set) < len(sequence_ids)

    if ref_names:
        response["mismatched_index"] = sequence_id_set != set(ref_names)

    response["failed"] = response["missing_index"] or response["mismatched_index"] or response[
        "missing_recent_history"]

    return response


def organize_sequences(database):
    database.sequences.update({}, {
        "$unset": {
            "neighbours": "",
            "proteins": "",
            "molecule_type": "",
            "molecular_structure": ""
        }
    })


def organize_hosts(database):
    database.hosts.update({"job": {"$exists": False}}, {
        "$set": {
            "job": None
        }
    }, multi=True)

    for host in database.hosts.find():
        if "ready" not in host:
            try:
                ready = host["added"]
            except KeyError:
                ready = True

            database.hosts.update_one({"_id": host["_id"]}, {
                "$unset": {
                    "added": ""
                },

                "$set": {
                    "ready": ready
                }
            })


def organize_users(database):
    # If any users lack the ``primary_group`` field or it is None, add it with a value of "".
    database.users.update({"$or": [
        {"primary_group": {"$exists": False}},
        {"primary_group": None}
    ]}, {
        "$set": {"primary_group": ""}
    }, multi=True)

    # Assign default user settings to users without defined settings.
    database.users.update({"settings": {}}, {
        "$set": {"settings": {"show_ids": False, "show_versions": False}}
    }, multi=True)

    # Make sure permissions are correct for all users.
    for user in database.users.find():
        groups = database.groups.find({"_id": {
            "$in": user["groups"]
        }})

        database.users.update({"_id": user["_id"]}, {
            "$set": {
                "permissions": merge_group_permissions(list(groups))
            }
        })

def organize_groups(database):

    for group in database.groups.find():
        default_setting = True if group["_id"] == "administrator" else False

        permissions = {perm: default_setting for perm in PERMISSIONS}

        for perm in permissions:
            try:
                permissions[perm] = group["permissions"][perm]
            except KeyError:
                pass

        database.groups.update({"_id": group["_id"]}, {
            "$set": {
                "permissions": permissions
            }
        })


def organize_jobs(database):
    database.jobs.update({}, {
        "$unset": {
            "archived": ""
        }
    })


def organize_samples(database):
    for sample in database.samples.find({}):
        analyses = list(database.analyses.find({"sample_id": sample["_id"]}, ["ready", "algorithm"]))

        database.samples.update({"_id": sample["_id"]}, {
            "$set": calculate_algorithm_tags(analyses),
            "$inc": {"_version": 1}
        })


def organize_files(database):
    database.files.update({"reserved": {"$exists": False}}, {
        "$set": {
            "reserved": False
        }
    }, multi=True)
