import arrow
import hashlib
import os

import virtool.virus
import virtool.virus_index
import virtool.sample
import virtool.organize_utils
from virtool.user_permissions import PERMISSIONS
from virtool.user_groups import merge_group_permissions


async def organize_viruses(db, logger_cb=None):
    count = 0

    for virus_id in await db.history.distinct("entry_id"):
        await virtool.virus.upgrade_legacy_virus_and_history(db, virus_id)
        count += 1

        if logger_cb and count % 100 == 0:
            logger_cb("  {}".format(count))


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

    async for document in db.jobs.find({"status.date": {"$exists": True}}, ["status"]):
        status = document["status"]

        for s in status:
            s["timestamp"] = s.pop("date")

        await db.jobs.update_one({"_id": document["_id"]}, {
            "$set": {
                "status": status
            }
        })


async def organize_samples(db, settings):
    """
    Bring sample documents up-to-date by doing the following:

        - rename ``added`` field to ``created_at``
        - unset deprecated ``_version`` field
        - update documents to use new ``user`` subdocument structure
        - update algorithm tags to reflect status of associated analyses (ie. which ones are complete)

    :param db: a Motor connection to the database to update
    :type db: :class:`motor.motor_asyncio.AsyncIOMotorCollection`

    """
    samples_path = os.path.join(settings.get("data_path"), "samples")

    if os.path.isdir(samples_path):
        for dirname in [n for n in os.listdir(samples_path) if n.startswith("sample_")]:
            os.rename(
                os.path.join(samples_path, dirname),
                os.path.join(samples_path, dirname.replace("sample_", ""))
            )

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

    async for sample in db.samples.find({"subtraction": {"$exists": True}}, ["subtraction"]):
        if isinstance(sample["subtraction"], str):
            await db.samples.update_one({"_id": sample["_id"]}, {
                "$set": {
                    "subtraction": {
                        "id": sample["subtraction"]
                    }
                }
            })


async def organize_hmms(db):
    await virtool.organize_utils.unset_version_field(db.hmm)

    await db.hmm.update_many({"hidden": {"$exists": False}}, {
        "$set": {
            "hidden": False
        }
    })

    await db.hmm.update_many({}, {
        "$rename": {
            "definition": "names"
        },
        "$unset": {
            "label": ""
        }
    })


async def organize_analyses(db, logger_cb=None):
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

    projection = ["sample_id", "sample", "diagnosis", "index_id", "index_version", "job"]

    await db.analyses.delete_many({"ready": False})

    count = 0

    async for analysis in db.analyses.find({"index_id": {"$exists": True}}, projection):
        new_diagnosis = list()

        for sequence_id, hit in analysis["diagnosis"].items():
            hit.update({
                "id": sequence_id,
                "virus": {
                    "id": hit.pop("virus_id"),
                    "version": hit.pop("virus_version")
                }
            })

            new_diagnosis.append(hit)

        update = {
            "$set": {
                "diagnosis": new_diagnosis,
                "index": {
                    "id": analysis.pop("index_id"),
                    "version": analysis.pop("index_version")
                },
                "job": {
                    "id": analysis.get("job", None)
                }
            },
            "$unset": {
                "index_id": "",
                "index_version": ""
            }
        }

        sample_id = analysis.get("sample_id", None) or analysis.get("sample", None)

        if isinstance(sample_id, str):
            update["$set"]["sample"] = {
                "id": sample_id
            }

            update["$unset"]["sample_id"] = ""

        await db.analyses.update_one({"_id": analysis["_id"]}, update)

        count += 1

        if logger_cb and count % 100 == 0:
            logger_cb("  {}".format(count))

    # If the algorithm field is unset, set it to ``pathoscope_bowtie``.
    await db.analyses.update_many({"algorithm": {"$exists": False}}, {
        "$set": {
            "algorithm": "pathoscope_bowtie"
        }
    })

    async for analysis in db.analyses.find({"algorithm": "nuvs", "hmm": {"$exists": True}}, ["hmm"]):
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

            await db.analyses.update_one({"_id": analysis["_id"]}, {
                "$set": {
                    "hmm": hits
                }
            })

    await db.analyses.update_many({}, {
        "$unset": {
            "name": "",
            "discovery": "",
            "comments": ""
        },
        "$rename": {
            "timestamp": "created_at"
        }
    })

    # Delete any unfinished analyses.
    await db.analyses.delete_many({"ready": False})

    # Add sample names to sample embedded documents.
    sample_ids_without_names = await db.analyses.distinct("sample.id", {"sample.name": {"$exists": False}})

    sample_name_lookup = dict()

    async for sample in db.samples.find({"_id": {"$in": sample_ids_without_names}}, ["name"]):
        sample_name_lookup[sample["_id"]] = sample["name"]

    for sample_id, sample_name in sample_name_lookup.items():
        await db.analyses.update_many({"sample.id": sample_id}, {
            "$set": {
                "sample.name": sample_name
            }
        })


async def organize_indexes(db):
    await db.indexes.update_many({}, {
        "$unset": {
            "_version": ""
        },
        "$rename": {
            "index_version": "version",
            "timestamp": "created_at"
        }
    })

    async for document in db.indexes.find({"username": {"$exists": True}}, ["username"]):
        await db.indexes.update_one({"_id": document["_id"]}, {
            "$set": {
                "user": {
                    "id": document["username"]
                },
            },
            "$unset": {
                "username": ""
            }
        })


async def organize_subtraction(db, settings):
    hosts_path = os.path.join(settings.get("data_path"), "reference", "hosts")

    if os.path.isdir(hosts_path):
        os.rename(
            hosts_path,
            os.path.join(settings.get("data_path"), "reference", "subtraction")
        )

    collection_names = await db.collection_names()

    if "hosts" in collection_names and "subtraction" not in collection_names:
        await virtool.organize_utils.update_user_field(db.hosts)
        await virtool.organize_utils.unset_version_field(db.hosts)

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
        },
        "$rename": {
            "nucleotides": "gc"
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

    await db.users.update_many({"api_keys": {"$exists": False}}, {
        "$set": {
            "api_keys": []
        }
    })

    async for document in db.users.find({"identicon": {"$exists": False}}):
        await db.users.update_one({"_id": document["_id"]}, {
            "$set": {
                "identicon": hashlib.sha256(document["_id"].encode()).hexdigest()
            }
        })


async def organize_groups(db):
    if not await db.groups.count({"_id": "administrator"}):
        await db.groups.insert_one({
            "_id": "administrator"
        })

    async for group in db.groups.find():
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


async def organize_status(db):
    document = await db.status.find_one("software_update")

    if document and "process" not in document:
        await db.status.update_one({"_id": "software_update"}, {
            "$set": {
                "process": None
            }
        })
