import copy

import virtool.db.utils
import virtool.history.db
import virtool.otus.utils
import virtool.otus.db
import virtool.utils


async def add(db, otu_id: str, data: dict, user_id: str) -> dict:
    """
    Add an isolate to an existing OTU.

    :param db: the application database object
    :param otu_id: the id of the OTU
    :param data: the isolate data
    :param user_id: the user making the change
    :return: the isolate subdocument

    """
    document = await db.otus.find_one(otu_id)

    isolates = copy.deepcopy(document["isolates"])

    # True if the new isolate should be default and any existing isolates should be non-default.
    will_be_default = not isolates or data["default"]

    # Set ``default`` to ``False`` for all existing isolates if the new one should be default.
    if will_be_default:
        for isolate in isolates:
            isolate["default"] = False

    # Set the isolate as the default isolate if it is the first one.
    data["default"] = will_be_default

    # Get the complete, joined entry before the update.
    old = await virtool.otus.db.join(db, otu_id, document)

    isolate_id = await append(db, otu_id, isolates, data)

    # Get the joined entry now that it has been updated.
    new = await virtool.otus.db.join(db, otu_id)

    await virtool.otus.db.update_verification(db, new)

    isolate_name = virtool.otus.utils.format_isolate_name(data)

    description = f"Added {isolate_name}"

    if will_be_default:
        description += " as default"

    await virtool.history.db.add(
        db,
        "add_isolate",
        old,
        new,
        description,
        user_id
    )

    return dict(data, id=isolate_id, sequences=[])


async def append(db, otu_id, isolates, isolate):
    isolate_ids = [isolate["id"] for isolate in isolates]

    isolate_id = None

    while isolate_id is None or isolate_id in isolate_ids:
        isolate_id = virtool.utils.random_alphanumeric(length=3)

    # Push the new isolate to the database.
    await db.otus.update_one({"_id": otu_id}, {
        "$set": {
            "isolates": [*isolates, dict(isolate, id=isolate_id)],
            "verified": False
        },
        "$inc": {
            "version": 1
        }
    })

    return isolate_id


async def edit(db, otu_id, isolate_id, data, user_id):
    isolates = await virtool.db.utils.get_one_field(db.otus, "isolates", otu_id)
    isolate = virtool.otus.utils.find_isolate(isolates, isolate_id)

    old_isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    isolate.update(data)

    new_isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    old = await virtool.otus.db.join(db, otu_id)

    # Replace the isolates list with the update one.
    document = await db.otus.find_one_and_update({"_id": otu_id}, {
        "$set": {
            "isolates": isolates,
            "verified": False
        },
        "$inc": {
            "version": 1
        }
    })

    # Get the joined entry now that it has been updated.
    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    # Use the old and new entry to add a new history document for the change.
    await virtool.history.db.add(
        db,
        "edit_isolate",
        old,
        new,
        f"Renamed {old_isolate_name} to {new_isolate_name}",
        user_id
    )

    complete = await virtool.otus.db.join_and_format(db, otu_id, joined=new)

    return virtool.otus.utils.find_isolate(complete["isolates"], isolate_id)


async def remove(db, otu_id, isolate_id, user_id):
    document = await db.otus.find_one(otu_id)

    isolates = copy.deepcopy(document["isolates"])

    # Get any isolates that have the isolate id to be removed (only one should match!).
    isolate_to_remove = virtool.otus.utils.find_isolate(isolates, isolate_id)

    # Remove the isolate from the otu' isolate list.
    isolates.remove(isolate_to_remove)

    new_default = None

    # Set the first isolate as default if the removed isolate was the default.
    if isolate_to_remove["default"] and len(isolates):
        new_default = isolates[0]
        new_default["default"] = True

    old = await virtool.otus.db.join(db, otu_id, document)

    document = await db.otus.find_one_and_update({"_id": otu_id}, {
        "$set": {
            "isolates": isolates,
            "verified": False
        },
        "$inc": {
            "version": 1
        }
    })

    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    # Remove any sequences associated with the removed isolate.
    await db.sequences.delete_many({"otu_id": otu_id, "isolate_id": isolate_id})

    old_isolate_name = virtool.otus.utils.format_isolate_name(isolate_to_remove)

    description = f"Removed {old_isolate_name}"

    if isolate_to_remove["default"] and new_default:
        new_isolate_name = virtool.otus.utils.format_isolate_name(new_default)
        description += f" and set {new_isolate_name} as default"

    await virtool.history.db.add(
        db,
        "remove_isolate",
        old,
        new,
        description,
        user_id
    )


async def set_default(db, otu_id: str, isolate_id: str, user_id):
    """
    Set a new default isolate.

    :param db:
    :param otu_id:
    :param isolate_id:
    :param user_id:
    :return:
    """
    document = await db.otus.find_one(otu_id)

    isolate = virtool.otus.utils.find_isolate(document["isolates"], isolate_id)

    old = await virtool.otus.db.join(db, otu_id, document)

    # If the default isolate will be unchanged, immediately return the existing isolate.
    if isolate["default"]:
        return virtool.otus.utils.find_isolate(old["isolates"], isolate_id)

    # Set ``default`` to ``False`` for all existing isolates if the new one should be default.
    isolates = [{**isolate, "default": isolate_id == isolate["id"]} for isolate in document["isolates"]]

    # Replace the isolates list with the updated one.
    document = await db.otus.find_one_and_update({"_id": otu_id}, {
        "$set": {
            "isolates": isolates,
            "verified": False
        },
        "$inc": {
            "version": 1
        }
    })

    # Get the joined entry now that it has been updated.
    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    # Use the old and new entry to add a new history document for the change.
    await virtool.history.db.add(
        db,
        "set_as_default",
        old,
        new,
        f"Set {isolate_name} as default",
        user_id
    )

    return virtool.otus.utils.find_isolate(new["isolates"], isolate_id)
