import copy
import datetime
from dataclasses import dataclass

from pymongo import DeleteOne, InsertOne, UpdateOne
from virtool_core.models.enums import HistoryMethod

import virtool.utils
from virtool.history.utils import (
    calculate_diff,
    compose_history_description,
    derive_otu_information,
)
from virtool.otus.utils import verify
from virtool.types import Document
from virtool.utils import random_alphanumeric


@dataclass
class OTUInsertion:
    history: dict
    id: str
    otu: dict
    sequences: list[dict]


@dataclass
class OTUUpsertion:
    otu: UpdateOne
    sequence_deletes: list[DeleteOne]
    sequence_inserts: list[InsertOne]
    sequence_updates: list[UpdateOne]


def prepare_history(
    history_method: HistoryMethod,
    old: dict | None,
    new: dict | None,
    user_id: str,
) -> Document:
    """Add a change document to the history collection.

    :param history_method: the name of the method that executed the change
    :param old: the otu document prior to the change
    :param new: the otu document after the change
    :param user_id: the id of the requesting user
    :return: the change document
    """
    otu_id, otu_name, otu_version, ref_id = derive_otu_information(old, new)

    try:
        abbreviation = new["abbreviation"]
    except (TypeError, KeyError):
        abbreviation = old["abbreviation"]

    description = compose_history_description(
        history_method,
        otu_name,
        abbreviation,
    )

    match history_method:
        case HistoryMethod.create:
            diff = new
        case HistoryMethod.remove:
            diff = old
        case _:
            diff = calculate_diff(old, new)

    return {
        "_id": ".".join([str(otu_id), str(otu_version)]),
        "diff": diff,
        "method_name": history_method.value,
        "description": description,
        "created_at": virtool.utils.timestamp(),
        "otu": {"id": otu_id, "name": otu_name, "version": otu_version},
        "reference": {"id": ref_id},
        "index": {"id": "unbuilt", "version": "unbuilt"},
        "user": {"id": user_id},
    }


def prepare_otu_insertion(
    created_at: datetime.datetime,
    history_method: HistoryMethod,
    otu: dict,
    otu_id: str,
    ref_id: str,
    user_id: str,
) -> OTUInsertion:
    copied = copy.deepcopy(otu)

    copied.update(
        {
            "_id": otu_id,
            "created_at": created_at,
            "imported": True,
            "last_indexed_version": None,
            "reference": {"id": ref_id},
            "remote": {"id": otu["_id"]},
            "schema": otu.get("schema", []),
            "user": {"id": user_id},
            "version": 0,
        },
    )

    for isolate in copied["isolates"]:
        isolate["id"] = random_alphanumeric(length=12)

        for sequence in isolate["sequences"]:
            try:
                remote_sequence_id = sequence["remote"]["id"]
            except KeyError:
                remote_sequence_id = sequence.pop("_id")

            sequence.update(
                {
                    "_id": random_alphanumeric(length=12),
                    "accession": sequence["accession"],
                    "isolate_id": isolate["id"],
                    "otu_id": otu_id,
                    "segment": sequence.get("segment", ""),
                    "reference": {"id": ref_id},
                    "remote": {"id": remote_sequence_id},
                },
            )

        for key in isolate:
            if key not in ("default", "id", "sequences", "source_type", "source_name"):
                del isolate[key]

    issues = verify(copied)

    copied.update(
        {
            "issues": issues,
            "verified": issues is None,
        },
    )

    sequences = [
        sequence for isolate in copied["isolates"] for sequence in isolate["sequences"]
    ]

    for isolate in copied["isolates"]:
        del isolate["sequences"]

    return OTUInsertion(
        prepare_history(history_method, None, copied, user_id),
        otu_id,
        copied,
        sequences,
    )


def prepare_otu_update(
    new_otu: dict,
    old_otu: dict,
    reference_id: str,
):
    copied = copy.deepcopy(old_otu)

    old_sequence_remote_ids = {
        sequence["remote"]["id"]
        for isolate in copied["isolates"]
        for sequence in isolate["sequences"]
    }

    new_sequence_ids = {
        sequence["_id"]
        for isolate in new_otu["isolates"]
        for sequence in isolate["sequences"]
    }

    to_insert_sequence_remote_ids = new_sequence_ids - old_sequence_remote_ids
    to_update_sequence_remote_ids = new_sequence_ids & old_sequence_remote_ids

    copied.update(
        {
            "abbreviation": old_otu["abbreviation"],
            "isolates": old_otu["isolates"],
            "lower_name": old_otu["name"].lower(),
            "name": old_otu["name"],
            "schema": old_otu.get("schema", []),
            "version": old_otu["version"] + 1,
        },
    )

    otu_update = UpdateOne(
        {"_id": old_otu["_id"]},
        {
            "$inc": {"version": 1},
            "$set": {
                "abbreviation": old_otu["abbreviation"],
                "isolates": old_otu["isolates"],
                "lower_name": old_otu["name"].lower(),
                "name": old_otu["name"],
                "schema": old_otu.get("schema", []),
            },
        },
    )

    sequence_deletes = []
    sequence_inserts = []
    sequence_updates = []

    for isolate in new_otu["isolates"]:
        for sequence in isolate["sequences"]:
            sequence_remote_id = sequence["_id"]

            if sequence_remote_id in to_update_sequence_remote_ids:
                sequence_updates.append(
                    UpdateOne(
                        {"reference.id": reference_id, "remote.id": sequence_remote_id},
                        {
                            "$set": {
                                "accession": sequence["accession"],
                                "definition": sequence["definition"],
                                "host": sequence["host"],
                                "segment": sequence.get("segment", ""),
                                "sequence": sequence["sequence"],
                            },
                        },
                    ),
                )

            elif sequence_remote_id in to_insert_sequence_remote_ids:
                sequence_inserts.append(
                    InsertOne(
                        {
                            "_id": random_alphanumeric(length=12),
                            "accession": sequence["accession"],
                            "definition": sequence["definition"],
                            "host": sequence["host"],
                            "isolate_id": isolate["id"],
                            "otu_id": old_otu["_id"],
                            "segment": sequence.get("segment", ""),
                            "sequence": sequence["sequence"],
                            "reference": {"id": reference_id},
                            "remote": {"id": sequence_remote_id},
                        },
                    ),
                )

            else:
                sequence_deletes.append(
                    DeleteOne(
                        {"reference.id": reference_id, "remote.id": sequence_remote_id},
                    ),
                )

    return OTUUpsertion(
        otu_update,
        sequence_deletes,
        sequence_inserts,
        sequence_updates,
    )
