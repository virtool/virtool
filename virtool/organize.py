import virtool.utils

from virtool.permissions import PERMISSIONS
from virtool.users import reconcile_permissions


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


def organize_viruses(database):
    database.viruses.update({}, {
        "$unset": {
            "segments": ""
        }
    }, multi=True)


def organize_hosts(database):
    database.hosts.update({"job": {"$exists": False}}, {
        "$set": {
            "job": None
        }
    }, multi=True)


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

    # Make sure permissions are reconciled for all users.
    for user in database.users.find():
        groups = database.groups.find({"_id": {
            "$in": user["groups"]
        }})

        database.users.update({"_id": user["_id"]}, {
            "$set": {
                "permissions": reconcile_permissions(list(groups))
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

    quality_updates = list()

    for document in database.samples.find({"quality.left": {"$exists": True}}):
        # The quality data for the left side. Should be in every sample. It is the only side in single end
        # libraries.
        left = document["quality"]["left"]

        # The quality data for the right side. Only present for paired-end libraries.
        right = document["quality"].get("right", None)

        # We will make a quality dict describing one or both sides instead of each separately. Encoding is the same
        # for both sides.
        quality = {
            "encoding": left["encoding"].rstrip(),
            "count": left["count"],
            "length": left["length"],
            "gc": left["gc"]
        }

        # If a right side is present, sum the read counts and average the GC contents.
        if right:
            quality["count"] += right["count"]
            quality["gc"] = (left["gc"] + right["gc"]) / 2

            quality["length"] = [
                min(left["length"][0], right["length"][0]),
                max(left["length"][1], right["length"][1])
            ]

        bases_keys = ["mean", "median", "lower", "upper", "10%", "90%"]

        quality["bases"] = [[base[key] for key in bases_keys] for base in left["bases"]]

        if right:
            assert(len(left["bases"]) == len(right["bases"]))

            for i, base in enumerate(quality["bases"]):
                right_bases = [[base[key] for key in bases_keys] for base in right["bases"]]

                quality["bases"][i] = virtool.utils.average_list(
                    base,
                    right_bases[i]
                )

        composition_keys = ["g", "a", "t", "c"]

        quality["composition"] = [[base[key] for key in composition_keys] for base in left["composition"]]

        if right:
            assert (len(left["composition"]) == len(right["composition"]))

            for i, base in enumerate(quality["composition"]):
                right_composition = [[base[key] for key in composition_keys] for base in right["composition"]]

                quality["composition"][i] = virtool.utils.average_list(
                    base,
                    right_composition[i]
                )

        quality["sequences"] = [0] * 50

        for side in [left, right]:
            if side:
                for entry in side["sequences"]:
                    quality["sequences"][entry["quality"]] += entry["count"]

        quality_updates.append({
            "_id": document["_id"],
            "quality": quality
        })

    for entry in quality_updates:
        database.samples.update({"_id": entry["_id"]}, {
            "$set": {"quality": entry["quality"]}
        })

    database.samples.update({}, {
        "$unset": {"format": "", "analyses": ""},
        "$inc": {"_version": 1}
    }, multi=True)
