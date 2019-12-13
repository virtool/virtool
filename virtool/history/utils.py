import arrow
import datetime
import os
import json
import dictdiffer
import aiofiles


def calculate_diff(old, new):
    """
    Calculate the diff for a joined otu document before and after modification.

    :param old: the joined otu document before modification
    :type old: dict

    :param new: the joined otu document after modification
    :type new: dict

    :return: the diff
    :rtype: list

    """
    return list(dictdiffer.diff(old, new))


def compose_create_description(document):
    name = document["name"]
    abbreviation = document.get("abbreviation")

    # Build a ``description`` field for the otu creation change document.
    description = f"Created {name}"

    # Add the abbreviation to the description if there is one.
    if abbreviation:
        return f"{description} ({abbreviation})"

    return description


def compose_edit_description(name, abbreviation, old_abbreviation, schema):
    description = None

    if name:
        description = f"Changed name to {name}"

    if abbreviation is not None:
        # Abbreviation is being removed.
        if abbreviation == "" and old_abbreviation:
            abbreviation_phrase = f"removed abbreviation {old_abbreviation}"

        # Abbreviation is being added where one didn't exist before
        elif abbreviation and not old_abbreviation:
            abbreviation_phrase = f"added abbreviation {abbreviation}"

        # Abbreviation is being changed from one value to another.
        else:
            abbreviation_phrase = f"changed abbreviation to {abbreviation}"

        if description:
            description = f"{description} and {abbreviation_phrase}"
        else:
            description = abbreviation_phrase[:1].upper() + abbreviation_phrase[1:]

    if schema is not None:
        if description:
            description += " and modified schema"
        else:
            description = "Modified schema"

    return description


def compose_remove_description(document):
    name = document["name"]
    abbreviation = document.get("abbreviation")

    description = f"Removed {name}"

    if abbreviation:
        return f"{description} ({abbreviation})"

    return description


def join_diff_path(data_path, otu_id, otu_version):
    return os.path.join(data_path, f"{otu_id}_{otu_version}.json")


def json_encoder(o):
    if isinstance(o, datetime.datetime):
        return arrow.get(o).isoformat()

    return o


def json_object_hook(o):
    for key, value in o.items():
        if key == "created_at":
            o[key] = arrow.get(value).naive

    return o


async def read_diff_file(data_path, otu_id, otu_version):
    """
    Read a history JSON file.

    """
    path = join_diff_path(data_path, otu_id, otu_version)

    async with aiofiles.open(path, "r") as f:
        return json.loads(await f.read(), object_hook=json_object_hook)


async def write_diff_file(data_path, otu_id, otu_version, body):
    path = join_diff_path(data_path, otu_id, otu_version)

    async with aiofiles.open(path, "w") as f:
        json_string = json.dumps(body, default=json_encoder)
        await f.write(json_string)
