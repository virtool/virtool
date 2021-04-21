import copy
from typing import Optional

import virtool.db.utils
import virtool.history.db
import virtool.otus.db
import virtool.otus.utils
import virtool.utils
from virtool.types import App


async def add(app, otu_id: str, data: dict, user_id: str, isolate_id: Optional[str] = None) -> dict:
    """
    Add an isolate to an existing OTU.

    :param app: the application object
    :param otu_id: the id of the OTU
    :param data: the isolate data
    :param user_id: the user making the change
    :param isolate_id: an optional ID to force for the isolate
    :return: the isolate sub-document

    """
    db = app["db"]

    document = await db.otus.find_one(otu_id)

    isolates = copy.deepcopy(document["isolates"])

    # True if the new isolate should be default and any existing isolates should be non-default.
    will_be_default = not isolates or data["default"]

    # Set ``default`` to ``False`` for all existing isolates if the new one should be default.
    if will_be_default:
        for isolate in isolates:
            isolate["default"] = False

    # Get the complete, joined entry before the update.
    old = await virtool.otus.db.join(db, otu_id, document)

    existing_ids = [isolate["id"] for isolate in isolates]

    if isolate_id is None:
        isolate_id = virtool.utils.random_alphanumeric(length=3, excluded=existing_ids)

    if isolate_id in existing_ids:
        raise ValueError(f"Isolate ID already exists: {isolate_id}")

    isolate = {
        "id": isolate_id,
        "default": will_be_default,
        "source_type": data["source_type"],
        "source_name": data["source_name"]
    }

    # Push the new isolate to the database.
    await db.otus.update_one({"_id": otu_id}, {
        "$set": {
            "isolates": [*isolates, isolate],
            "verified": False
        },
        "$inc": {
            "version": 1
        }
    })

    # Get the joined entry now that it has been updated.
    new = await virtool.otus.db.join(db, otu_id)

    await virtool.otus.db.update_verification(db, new)

    isolate_name = virtool.otus.utils.format_isolate_name(data)

    description = f"Added {isolate_name}"

    if will_be_default:
        description += " as default"

    await virtool.history.db.add(
        app,
        "add_isolate",
        old,
        new,
        description,
        user_id
    )

    return {**isolate, "sequences": []}


async def edit(app: App, otu_id: str, isolate_id: str, data: dict, user_id: str) -> dict:
    db = app["db"]

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
        app,
        "edit_isolate",
        old,
        new,
        f"Renamed {old_isolate_name} to {new_isolate_name}",
        user_id
    )

    complete = await virtool.otus.db.join_and_format(db, otu_id, joined=new)

    return virtool.otus.utils.find_isolate(complete["isolates"], isolate_id)


async def remove(app: App, otu_id: str, isolate_id: str, user_id: str):
    db = app["db"]

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
        app,
        "remove_isolate",
        old,
        new,
        description,
        user_id
    )


async def set_default(app, otu_id: str, isolate_id: str, user_id: str) -> dict:
    """
    Set a new default isolate.

    :param app: the application object
    :param otu_id: the ID of the parent OTU
    :param isolate_id: the ID of the isolate set as default
    :param user_id: the ID of the requesting user
    :return: the updated isolate

    """
    db = app["db"]

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
    new = await virtool.otus.db.join(
        db,
        otu_id,
        document
    )

    await virtool.otus.db.update_verification(db, new)

    isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    # Use the old and new entry to add a new history document for the change.
    await virtool.history.db.add(
        app,
        "set_as_default",
        old,
        new,
        f"Set {isolate_name} as default",
        user_id
    )

    return virtool.otus.utils.find_isolate(new["isolates"], isolate_id)
