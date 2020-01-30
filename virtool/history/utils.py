import arrow
from typing import Tuple, Union, List
import datetime
import os
import json
import dictdiffer
import aiofiles


def calculate_diff(old: dict, new: dict) -> list:
    """
    Calculate the diff for a joined otu document before and after modification.

    :param old: the joined otu document before modification
    :param new: the joined otu document after modification
    :return: the diff

    """
    return list(dictdiffer.diff(old, new))


def compose_create_description(document: dict) -> str:
    """
    Compose a change description for the creation of a new OTU given its document.

    :param document: the OTU document
    :return: a change description

    """
    name = document["name"]
    abbreviation = document.get("abbreviation")

    # Build a ``description`` field for the otu creation change document.
    description = f"Created {name}"

    # Add the abbreviation to the description if there is one.
    if abbreviation:
        return f"{description} ({abbreviation})"

    return description


def compose_edit_description(name: Union[str, None], abbreviation: Union[str, None], old_abbreviation: Union[str, None], schema: Union[dict, None]):
    """
    Compose a change description for an edit on an existing OTU.

    :param name: an updated name value
    :param abbreviation: an updated abbreviation value
    :param old_abbreviation: the old abbreviation value
    :param schema: a new schema `dict`
    :return: a change description

    """
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


def compose_remove_description(document: dict) -> str:
    """
    Compose a change description for removing an OTU.

    :param document: the OTU document that is being removed
    :return: a change description

    """
    name = document["name"]
    abbreviation = document.get("abbreviation")

    description = f"Removed {name}"

    if abbreviation:
        return f"{description} ({abbreviation})"

    return description


def derive_otu_information(old: Union[dict, None], new: Union[dict, None]) -> Tuple[str, str, Union[int, str], str]:
    """
    Derive OTU information for a new change document from the old and new joined OTU documents.

    :param old: the old, joined OTU document
    :param new: the new, joined OTU document
    :return: the parent reference ID and otu ID, name, and abbreviation

    """
    try:
        otu_id = old["_id"]
    except TypeError:
        otu_id = new["_id"]

    try:
        otu_name = old["name"]
    except TypeError:
        otu_name = new["name"]

    try:
        otu_version = int(new["version"])
    except (TypeError, KeyError):
        otu_version = "removed"

    try:
        ref_id = old["reference"]["id"]
    except (TypeError, KeyError):
        ref_id = new["reference"]["id"]

    return otu_id, otu_name, otu_version, ref_id


def join_diff_path(data_path: str, otu_id: str, otu_version: Union[int, str]) -> str:
    """
    Derive the path to a diff file based on the application `data_path` setting and the OTU ID and version.

    :param data_path: the application data path settings
    :param otu_id: the OTU ID to join a diff path for
    :param otu_verison: the OTU version to join a diff path for
    :return: the change path

    """
    return os.path.join(data_path, "history", f"{otu_id}_{otu_version}.json")


def json_encoder(o):
    """
    A custom JSON encoder function that stores `datetime` objects as ISO format date strings.

    :param o: a JSON value object
    :return: the object converted to a `datetime` if necessary

    """
    if isinstance(o, datetime.datetime):
        return arrow.get(o).isoformat()

    return o


def json_object_hook(o: dict) -> dict:
    """
    A JSON decoder hook for converting `created_at` fields from ISO format dates to `datetime` objects.

    :param o: the JSON parsing dict
    :return: the parsed dict

    """
    for key, value in o.items():
        if key == "created_at":
            o[key] = arrow.get(value).naive

    return o


async def read_diff_file(data_path, otu_id, otu_version):
    """
    Read a history diff JSON file.

    """
    path = join_diff_path(data_path, otu_id, otu_version)

    async with aiofiles.open(path, "r") as f:
        return json.loads(await f.read(), object_hook=json_object_hook)


async def remove_diff_files(app, id_list: List[str]):
    """
    Remove multiple diff files given a list of change IDs (`id_list`).

    :param app: the application object
    :param id_list: a list of change IDs to remove diff files for

    """
    data_path = app["settings"]["data_path"]

    for change_id in id_list:
        otu_id, otu_version = change_id.split(".")

        path = join_diff_path(
            data_path,
            otu_id,
            otu_version
        )

        try:
            await app["run_in_thread"](os.remove, path)
        except FileNotFoundError:
            pass


async def write_diff_file(data_path, otu_id, otu_version, body):
    path = join_diff_path(data_path, otu_id, otu_version)

    async with aiofiles.open(path, "w") as f:
        json_string = json.dumps(body, default=json_encoder)
        await f.write(json_string)
