"""Report legacy (string) user ids still present in Mongo collections.

Run inside a Virtool container (reads VT_MONGODB_CONNECTION_STRING):

    python scripts/check_legacy_user_ids.py

Read-only: it only counts and samples; it never writes. Buckets the BSON type
of every denormalized ``user.id`` (and the nested ``installed`` user ids in
``status``/``references``) so you can see which collections still hold legacy
string ids that crash the user transform.
"""

import os

from pymongo import MongoClient
from pymongo.uri_parser import parse_uri

SIMPLE_USER_COLLECTIONS = (
    "keys",
    "samples",
    "subtractions",
    "analyses",
    "otus",
    "history",
    "indexes",
)

SAMPLE_LIMIT = 10


def _type_counts(collection, id_path: str, match: dict) -> list[dict]:
    """Group a field by BSON type, with a sample of string values."""
    return list(
        collection.aggregate(
            [
                {"$match": match},
                {
                    "$group": {
                        "_id": {"$type": f"${id_path}"},
                        "count": {"$sum": 1},
                        "samples": {"$addToSet": f"${id_path}"},
                    },
                },
                {"$sort": {"count": -1}},
            ],
        ),
    )


def _report(name: str, rows: list[dict]) -> None:
    if not rows:
        print(f"  {name}: (no documents carry this field)")
        return

    for row in rows:
        bson_type = row["_id"]
        line = f"  {name}: type={bson_type:<10} count={row['count']}"
        if bson_type == "string":
            sample = sorted(str(s) for s in row["samples"])[:SAMPLE_LIMIT]
            line += f"  legacy ids (sample): {sample}"
        print(line)


def main() -> None:
    connection_string = os.environ["VT_MONGODB_CONNECTION_STRING"]
    db_name = parse_uri(connection_string)["database"]

    client = MongoClient(connection_string, serverSelectionTimeoutMS=6000)
    db = client[db_name]

    print(f"Database: {db_name}\n")

    print("Top-level `user` field shape by type:")
    for collection_name in SIMPLE_USER_COLLECTIONS:
        _report(
            collection_name,
            _type_counts(db[collection_name], "user", {"user": {"$exists": True}}),
        )

    print("\nTop-level user.id by type (where `user` is an object):")
    for collection_name in SIMPLE_USER_COLLECTIONS:
        _report(
            collection_name,
            _type_counts(db[collection_name], "user.id", {"user": {"$type": "object"}}),
        )

    print("\nreferences user.id / installed.user.id by type:")
    _report(
        "references.user.id",
        _type_counts(db.references, "user.id", {"user": {"$type": "object"}}),
    )
    _report(
        "references.installed.user.id",
        _type_counts(
            db.references,
            "installed.user.id",
            {"installed": {"$type": "object"}},
        ),
    )

    print("\nstatus (hmm) nested user.id by type:")
    _report(
        "status.installed.user.id",
        _type_counts(
            db.status,
            "installed.user.id",
            {"installed": {"$type": "object"}},
        ),
    )

    print("\nDone. Any 'type=string' rows above are unmigrated legacy user ids.")


if __name__ == "__main__":
    main()
