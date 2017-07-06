import os
import arrow

import virtool.virus
import virtool.virus_index
import virtool.sample
import virtool.organize_utils
from virtool.user_permissions import PERMISSIONS
from virtool.user_groups import merge_group_permissions


async def organize_jobs(db):
    """
    Unset deprecated fields ``_version`` and ``archived``. Update document to use new ``user`` subdocument structure.

    :param db: a Motor connection to the database to update
    :type db: :class:`motor.motor_asyncio.AsyncIOMotorCollection`

    """
    await virtool.organize_utils.update_user_field(db.jobs)
    await virtool.organize_utils.unset_version_field(db.jobs)

    await db.jobs.update_many({}, {
        "$unset": {
            "archived": ""
        }
    })


async def organize_samples(db):
    """
    Bring sample documents up-to-date by doing the following:

        - rename ``added`` field to ``created_at``
        - unset deprecated ``_version`` field
        - update documents to use new ``user`` subdocument structure
        - update algorithm tags to reflect status of associated analyses (ie. which ones are complete)

    :param db: a Motor connection to the database to update
    :type db: :class:`motor.motor_asyncio.AsyncIOMotorCollection`

    """
    await virtool.organize_utils.update_user_field(db.samples)
    await virtool.organize_utils.unset_version_field(db.samples)

    await db.samples.update_many({}, {
        "$rename": {
            "added": "created_at"
        }
    })

    async for sample in db.samples.find({}, ["_id", "created_at"]):
        analyses = await db.analyses.find({"sample.id": sample["_id"]}, ["ready", "algorithm"]).to_list(None)

        await db.samples.update_one({"_id": sample["_id"]}, {
            "$set": virtool.sample.calculate_algorithm_tags(analyses)
        })

        if isinstance(sample["created_at"], str):
            await db.samples.update_one({"_id": sample["_id"]}, {
                "$set": {
                    "created_at": arrow.get(sample["created_at"]).datetime
                }
            })

async def organize_analyses(db):
    """
    Bring analysis documents up-to-date by doing the following:

        - unset many deprecated fields
        - make sure all NuVs analysis records reference HMMs in the database rather than storing the HMM data themselves
        - rename ``timestamp`` field to ``created_at``
        - use new ``user`` subdocument structure
        - use ``sample`` subdocument structure instead of flat ``sample_id`` field
        - set ``algorithm`` field to ``pathoscope_bowtie`` if the field is unset
        - delete any analyses with the ``ready`` field set to ``False``

    """
    await virtool.organize_utils.unset_version_field(db.analyses)
    await virtool.organize_utils.update_user_field(db.analyses)

    # Only do this if HMM records are defined in the database.
    if await db.hmm.count() > 0:
        async for analysis in db.analyses.find({"algorithm": "nuvs"}):
            # If the definition key is defined, the record is storing the information for each HMM and must be
            # updated.
            if "definition" in analysis["hmm"][0]:
                hits = analysis["hmm"]

                # Fix up the HMM hit entries for the analysis.
                for hit in hits:
                    # Get the database id for the HMM the hit should be linked to.
                    cluster = int(hit["hit"].split("_")[1])
                    hmm = await db.hmm.find_one({"cluster": cluster}, {"_id": True})

                    # Get rid of the unnecessary fields.
                    del hit["definition"]
                    del hit["families"]

                    # Change the hit field to the id for the HMM record instead of vFam_###.
                    hit["hit"] = hmm["_id"]

                # Commit the new hit entries to the database.
                await db.analyses.update_one({"_id": analysis["_id"]}, {
                    "$set": {
                        "hmm": hits
                    }
                })

    # Unset or rename a bunch of fields.
    await db.analyses.update_many({}, {
        "$unset": {
            "discovery": "",
            "_version": "",
            "name": "",
            "comments": ""
        },
        "$rename": {
            "timestamp": "created_at"
        }
    })

    # Implement subdocument structure for ``sample`` field.
    async for document in db.analyses.find({}, ["sample", "sample_id"]):
        sample_id = document.get("sample_id", None) or document.get("sample", None)

        if isinstance(sample_id, str):
            await db.analyses.update_one({"_id": document["_id"]}, {
                "$set": {
                    "sample": {
                        "id": sample_id
                    }
                },
                "$unset": {
                    "sample_id": ""
                }
            })

    # If the algorithm field is unset, set it to ``pathoscope_bowtie``.
    await db.analyses.update_many({"algorithm": {"$exists": False}}, {
        "$set": {
            "algorithm": "pathoscope_bowtie"
        }
    })

    # Delete any unfinished analyses.
    await db.analyses.delete_many({"ready": False})


async def organize_viruses(db):
    await db.viruses.update_many({}, {
        "$unset": {
            "segments": "",
            "abbrevation": "",
            "new": "",
            "username": "",
            "user_id": ""
        }
    })

    async for document in db.viruses.find({"isolates.isolate_id": {"$exists": True}}, ["isolates"]):
        for isolate in document["isolates"]:
            try:
                isolate["id"] = isolate["isolate_id"]
            except KeyError:
                pass

        await db.viruses.update_one({"_id": document["_id"]}, {
            "$set": {
                "isolates": document["isolates"]
            }
        })


def organize_sequences(database):
    database.sequences.update_many({}, {
        "$unset": {
            "neighbours": "",
            "proteins": "",
            "molecule_type": "",
            "molecular_structure": ""
        }
    })


async def organize_indexes(db):
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


async def organize_history(db):
    """
    For now, just rename the ``timestamp`` field to ``created_at``.

    """
    await virtool.organize_utils.update_user_field(db.history)

    await db.history.update_many({}, {
        "$rename": {
            "timestamp": "created_at"
        }
    })

    async for change in db.history.find({"virus_id": {"$exists": True}}):
        await db.history.update_one({"_id": change["_id"]}, {
            "$set": {
                "virus": {
                    "id": change["virus_id"],
                    "version": change["virus_version"],
                    "name": change["virus_name"]
                },
                "index": {
                    "id": change["index_id"],
                    "version": change["index_version"]
                }
            },
            "$unset": {
                "virus_id": "",
                "virus_version": "",
                "virus_name": "",
                "index_id": "",
                "index_version": ""
            }
        })


async def organize_subtraction(db):
    await virtool.organize_utils.update_user_field(db.hosts)
    await virtool.organize_utils.unset_version_field(db.hosts)

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

    await db.subtraction.update_many({}, {
        "$unset": {
            "lengths": ""
        }
    })

    async for subtraction in db.subtraction.find({}, ["job"]):
        job_field = subtraction.get("job", None) or subtraction.get("job_id", None)

        if isinstance(job_field, str):
            job_field = {
                "id": job_field
            }

        await db.subtraction.update_one({"_id": subtraction["_id"]}, {
            "$set": {
                "job": job_field
            }
        })

    async for host in db.subtraction.find({}, ["file", "file_id", "file_name"]):
        file_id = host.get("file_id", None) or host.get("file", None)

        if isinstance(file_id, str):
            await db.subtraction.update_one({"_id": host["_id"]}, {
                "$set": {
                    "file": {
                        "id": file_id,
                        "name": host.get("file_name", None)
                    }
                }
            })

    async for host in db.subtraction.find({"ready": {"$exists": False}}, ["ready"]):
        await db.subtraction.update_one({"_id": host["_id"]}, {
            "$set": {
                "ready": host.get("added", True)
            }
        })

    await db.subtraction.update_many({}, {
        "$unset": {
            "added": ""
        }
    })


async def organize_users(db):
    await virtool.organize_utils.unset_version_field(db.users)

    # Unset sessions field. These are stored in a separate collection now.
    await db.users.update_many({}, {
        "$unset": {
            "sessions": ""
        }
    })

    # If any users lack the ``primary_group`` field or it is None, add it with a value of "".
    await db.users.update_many({"$or": [
        {"primary_group": {"$exists": False}},
        {"primary_group": None}
    ]}, {
        "$set": {"primary_group": ""}
    })

    # Make sure permissions are correct for all users.
    async for user in db.users.find():
        groups = await db.groups.find({"_id": {
            "$in": user["groups"]
        }}).to_list(None)

        await db.users.update_one({"_id": user["_id"]}, {
            "$set": {
                "permissions": merge_group_permissions(list(groups))
            }
        })


async def organize_groups(db):
    async for group in await db.groups.find():
        default_setting = True if group["_id"] == "administrator" else False

        permissions = {perm: default_setting for perm in PERMISSIONS}

        for perm in permissions:
            try:
                permissions[perm] = group["permissions"][perm]
            except KeyError:
                pass

        await db.groups.update_one({"_id": group["_id"]}, {
            "$set": {
                "permissions": permissions
            }
        })


def organize_files(db):
    db.files.update_many({"reserved": {"$exists": False}}, {
        "$set": {
            "reserved": False
        }
    })
