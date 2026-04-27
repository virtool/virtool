import copy
import datetime
from dataclasses import dataclass

import virtool.utils
from virtool.history.utils import (
    calculate_diff,
    compose_history_description,
    derive_otu_information,
)
from virtool.models.enums import HistoryMethod
from virtool.otus.utils import verify
from virtool.types import Document
from virtool.utils import random_alphanumeric


@dataclass
class PreparedInsertionHistory:
    """A history record prepared for two-phase insertion.

    The diff is stored in PostgreSQL's ``history_diffs`` table keyed by
    ``id``, while ``document`` is inserted into Mongo's ``history`` collection
    with a ``"postgres"`` sentinel in place of the diff.
    """

    diff: dict
    document: Document
    id: str


@dataclass
class OTUInsertion:
    """Represents the insertion of an OTU, sequences, and creation history record."""

    history: PreparedInsertionHistory
    id: str
    otu: dict
    sequences: list[dict]


def prepare_insertion_history(
    history_method: HistoryMethod,
    old: dict | None,
    new: dict | None,
    user_id: str,
) -> PreparedInsertionHistory:
    """Prepare a history record for bulk OTU insertion.

    The diff is returned separately from the Mongo document so the diff can be
    written to PostgreSQL's ``history_diffs`` table while the Mongo document
    stores the ``"postgres"`` sentinel.

    :param history_method: the name of the method that executed the change
    :param old: the otu document prior to the change
    :param new: the otu document after the change
    :param user_id: the id of the requesting user
    :return: the prepared history record
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

    change_id = ".".join([str(otu_id), str(otu_version)])

    return PreparedInsertionHistory(
        diff=diff,
        document={
            "_id": change_id,
            "diff": "postgres",
            "method_name": history_method.value,
            "description": description,
            "created_at": virtool.utils.timestamp(),
            "otu": {"id": otu_id, "name": otu_name, "version": otu_version},
            "reference": {"id": ref_id},
            "index": {"id": "unbuilt", "version": "unbuilt"},
            "user": {"id": user_id},
        },
        id=change_id,
    )


def prepare_otu_insertion(
    created_at: datetime.datetime,
    history_method: HistoryMethod,
    otu: dict,
    ref_id: str,
    user_id: str,
) -> OTUInsertion:
    otu_id = random_alphanumeric(length=8)

    copied = copy.deepcopy(otu)

    copied.update(
        {
            "_id": otu_id,
            "created_at": created_at,
            "imported": True,
            "last_indexed_version": None,
            "lower_name": otu["name"].lower(),
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
        prepare_insertion_history(history_method, None, copied, user_id),
        otu_id,
        copied,
        sequences,
    )
