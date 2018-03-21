import pymongo

import virtool.utils


async def clone(db, name, user_id, source_id):

    source = await db.references.find_one(source_id)

    if source is None:
        raise ValueError("Source not found")

    ref = await create(
        db,
        name,
        user_id=user_id,
        data_type=source["data_type"],
        users=[get_owner_user(user_id)],
        cloned_from={
            "id": source["_id"]
        }
    )

    created_at = virtool.utils.timestamp()

    async for source_virus in db.targets.find({"_id": source["_id"]}):
        source_virus.update({
            "_id": await virtool.utils.get_new_id("targets"),
            "version": 0,
            "created_at": created_at,
            "ref": {
                "id": ref["_id"]
            }
        })


async def create(db, name, user_id=None, cloned_from=None, created_at=None, data_type="whole_genome", github="", ref_id=None, ready=False, users=None):

    created_at = created_at or virtool.utils.timestamp()

    ref_id = ref_id or await virtool.utils.get_new_id(db.viruses)

    user = None

    if user_id:
        user = {
            "id": user_id
        }

    users = users or list()

    if not any(user["id"] == user_id for user in users):
        users.append(get_owner_user(user_id))

    document = {
        "_id": ref_id,
        "created_at": created_at,
        "name": name,
        "public": True,
        "ready": ready,
        "users": users,
        "user": user
    }

    await db.references.insert_one(document)

    return document


async def create_original(db):
    # The `created_at` value should be the `created_at` value for the earliest history document.
    first_change = await db.history.find_one({}, ["created_at"], sort=[("created_at", pymongo.ASCENDING)])
    created_at = first_change["created_at"]

    # The reference is `ready` if at least one of the original indexes is ready.
    ready = bool(await db.indexes.count({"ready": True}))

    users = await db.users.find({}, ["_id", "administrator", "permissions"])

    for user in users:
        permissions = users.pop("permissions")

        users.update({
            "modify": user["administrator"],
            "modify_viruses": permissions.get("modify_virus", False)
        })

    return await create(db, "Original", created_at=created_at, ref_id="original", ready=ready)


async def get_last_build(db, ref_id):
    document = await db.indexes.find_one({"ref.id": ref_id}, ["created_at", "user"])
    return virtool.utils.base_processor(document)


async def get_owner_user(user_id):
    return {
        "id": user_id,
        "modify": True,
        "modify_virus": True,
        "remove": True
    }



