import virtool.db.refs
import virtool.db.utils
import virtool.refs
import virtool.users
import virtool.utils

REF_QUERY = {
    "ref": {
        "$exists": False
    }
}


async def add_original_ref(collection):
    await collection.update_many(REF_QUERY, {
        "$set": {
            "ref": {
                "id": "original"
            }
        }
    })


async def delete_unready(collection):
    await collection.delete_many({"ready": False})


async def organize(db, server_version):
    await organize_analyses(db)
    await organize_files(db)
    await organize_groups(db)
    await organize_history(db)
    await organize_indexes(db)
    await organize_references(db)
    await organize_kinds(db)
    await organize_sequences(db)
    await organize_status(db, server_version)
    await organize_subtraction(db)
    await organize_users(db)
    await organize_references(db)


async def organize_analyses(db):
    """
    Delete any analyses with the ``ready`` field set to ``False``.

    """
    await delete_unready(db.analyses)
    await add_original_ref(db.analyses)


async def organize_files(db):
    await db.files.update_many({}, {
        "$set": {
            "reserved": False
        }
    })


async def organize_groups(db):
    await db.groups.delete_one({"_id": "administrator"})

    async for group in db.groups.find():
        await db.groups.update_one({"_id": group["_id"]}, {
            "$set": {
                "permissions": {perm: group["permissions"].get(perm, False) for perm in virtool.users.PERMISSIONS}
            }
        })


async def organize_history(db):
    await add_original_ref(db.history)


async def organize_indexes(db):
    await add_original_ref(db.indexes)


async def organize_kinds(db):
    if "viruses" in await db.collection_names():
        await db.viruses.rename("kinds")

    await add_original_ref(db.kinds)


async def organize_references(db):
    if await db.kinds.count() and not await db.references.count():
        await virtool.db.refs.create_original(db)


async def organize_sequences(db):
    async for document in db.sequences.find(REF_QUERY):
        document.update({
            "_id": await virtool.db.utils.get_new_id(db.sequences),
            "accession": document["_id"],
            "ref": {
                "id": "original"
            }
        })

        await db.sequences.insert_one(document)

    await db.sequences.delete_many(REF_QUERY)


async def organize_status(db, server_version):
    await db.status.update_one({"_id": "software_update"}, {
        "$set": {
            "process": None
        }
    }, upsert=True)

    await db.status.update_one({"_id": "version"}, {
        "$set": {
            "version": server_version
        }
    }, upsert=True)


async def organize_subtraction(db):
    await delete_unready(db.subtraction)


async def organize_users(db):
    async for document in db.users.find({"groups": "administrator"}):
        await db.users.update_one({"_id": document["_id"]}, {
            "$set": {
                "administrator": True
            },
            "$pull": {
                "groups": "administrator"
            }
        })
