from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.otus.db import write_legacy_otu, write_legacy_sequence
from virtool.types import Document

IMPORTED_CREATED_AT = datetime(2015, 10, 6, 20, 0, 0, 123456)
"""The ``created_at`` carried by an imported OTU, at microsecond precision.

Deliberately not a whole number of milliseconds. Mongo floors a datetime to the
millisecond, and ``static_time`` carries no microseconds at all, so a timestamp that
survives that truncation unchanged cannot catch a write path that stores more precision
than Mongo can hold.
"""


@pytest.fixture
def insert_otu(mongo, pg):
    """Insert an OTU document, and any sequences, into both stores.

    Seeds a literal OTU document the way the dual-write path would, for a test that
    needs a specific ``_id``, isolate id or version rather than whatever
    ``fake.otus.create`` invents. OTUs are read from Postgres, so a test that seeds only
    Mongo gets a ``404``.

    ``reference_id`` is written onto the document, so the caller does not have to know
    that an OTU's reference is embedded rather than a column.
    """

    async def func(
        document: Document,
        reference_id: int,
        sequences: list[Document] | None = None,
    ) -> Document:
        document = {**document, "reference": {"id": reference_id}}
        sequences = sequences or []

        await mongo.otus.insert_one(document)

        if sequences:
            await mongo.sequences.insert_many(sequences, session=None)

        async with AsyncSession(pg) as session:
            await write_legacy_otu(session, document)

            for sequence in sequences:
                await write_legacy_sequence(session, sequence)

            await session.commit()

        return document

    return func


@pytest.fixture
def test_imported_otu():
    """An OTU in the shape a reference import or clone writes.

    This is what ``prepare_otu_insertion`` produces: a ``created_at`` copied from the
    parent reference, the ``imported``, ``remote`` and ``user`` keys, and isolates whose
    sequences have been lifted out into the ``sequences`` collection.

    ``test_otu`` is the shape the API produces and carries no ``created_at`` at all,
    which is why it cannot exercise the datetime handling in the OTU write path.
    """
    return {
        "_id": "6116cba1",
        "abbreviation": "PVF",
        "created_at": IMPORTED_CREATED_AT,
        "imported": True,
        "isolates": [
            {
                "default": True,
                "id": "cab8b360",
                "source_name": "8816-v2",
                "source_type": "isolate",
            },
        ],
        "issues": None,
        "last_indexed_version": None,
        "lower_name": "prunus virus f",
        "name": "Prunus virus F",
        "reference": {"id": 1},
        "remote": {"id": "remote_otu"},
        "schema": [],
        "user": {"id": 1},
        "verified": True,
        "version": 0,
    }


@pytest.fixture
def test_otu(static_time):
    return {
        "_id": "6116cba1",
        "abbreviation": "PVF",
        "isolates": [
            {
                "default": True,
                "id": "cab8b360",
                "source_name": "8816-v2",
                "source_type": "isolate",
            },
        ],
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "name": "Prunus virus F",
        "reference": {"id": "hxn167"},
        "remote_id": None,
        "schema": [],
        "verified": False,
        "version": 0,
    }


@pytest.fixture
def test_isolate():
    return {
        "id": "cab8b360",
        "default": True,
        "source_name": "8816-v2",
        "source_type": "isolate",
    }


@pytest.fixture
def test_sequence():
    return {
        "_id": "abcd1234",
        "accession": "KX269872",
        "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
        "host": "sweet cherry",
        "isolate_id": "cab8b360",
        "reference": {"id": "ref"},
        "remote": None,
        "otu_id": "6116cba1",
        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
        "segment": None,
    }


@pytest.fixture
def test_merged_otu(static_time):
    return {
        "remote_id": None,
        "version": 0,
        "abbreviation": "PVF",
        "isolates": [
            {
                "default": True,
                "id": "cab8b360",
                "sequences": [
                    {
                        "_id": "abcd1234",
                        "accession": "KX269872",
                        "otu_id": "6116cba1",
                        "isolate_id": "cab8b360",
                        "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
                        "host": "sweet cherry",
                        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                        "segment": None,
                        "reference": {"id": "ref"},
                        "remote": None,
                    },
                ],
                "source_name": "8816-v2",
                "source_type": "isolate",
            },
        ],
        "reference": {"id": "hxn167"},
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "verified": False,
        "name": "Prunus virus F",
        "schema": [],
        "_id": "6116cba1",
    }
