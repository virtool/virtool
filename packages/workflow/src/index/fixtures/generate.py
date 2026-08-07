"""Generate the index artifact fixture and its golden query results.

This script is the provenance record for `virtool-index-sqlite-v1.sqlite`,
`golden.json` and `default.fa`. It is not run by CI; it exists so the fixture
can be regenerated and audited against the Python implementation the
TypeScript reader is pinned to.

Run it against a checkout of the Python server:

    cd /path/to/virtool
    .venv/bin/python /path/to/virtool-ui/packages/workflow/src/index/fixtures/generate.py

The OTUs, isolates, schema items and sequences below are deliberately supplied
in an order that does not match the order the queries must return them in. A
reader that leaks insertion order instead of applying Python's `ORDER BY`
produces a different FASTA, a different Bowtie2 index and a different SAM, so
the fixture has to be able to tell the two apart.
"""

import asyncio
import json
from pathlib import Path

from virtool.indexes.constants import INDEX_SQLITE_FILE_NAME
from virtool.workflow.data.indexes import WFIndex

HERE = Path(__file__).resolve().parent

REFERENCE = {
    "_id": "reference_1",
    "created_at": "2026-01-15T19:55:34.203324Z",
    "data_type": "genome",
    "name": "Plant Viruses",
    "organism": "virus",
}

OTUS = [
    {
        "_id": "otu_zeta",
        "abbreviation": "",
        "name": "Zeta virus",
        "taxid": None,
        "version": 0,
        "schema": [],
        "isolates": [
            {
                "id": "iso_z",
                "default": True,
                "source_type": "isolate",
                "source_name": "Z1",
                "sequences": [
                    {
                        "_id": "seq_z1",
                        "accession": "NC_000001",
                        "definition": "Zeta virus complete genome",
                        "host": None,
                        "segment": None,
                        "sequence": "ACGTACGTAC",
                    },
                ],
            },
        ],
    },
    {
        "_id": "otu_alpha",
        "abbreviation": "ABTV",
        "name": "Abaca bunchy top virus",
        "taxid": 1,
        "version": 3,
        "schema": [
            {"name": "DNA B", "molecule": None, "required": False},
            {"name": "DNA A", "molecule": "dsDNA", "required": True},
        ],
        "isolates": [
            {
                "id": "iso_b",
                "default": False,
                "source_type": "isolate",
                "source_name": "B1",
                "sequences": [
                    {
                        "_id": "seq_b2",
                        "accession": "NC_010318",
                        "definition": "Abaca bunchy top virus DNA B",
                        "host": "Musa sp.",
                        "segment": "DNA B",
                        "sequence": "TTTTGGGGCC",
                    },
                    {
                        "_id": "seq_b1",
                        "accession": "NC_010317",
                        "definition": "Abaca bunchy top virus DNA A",
                        "host": "Musa sp.",
                        "segment": "DNA A",
                        "sequence": "AAAACCCCGG",
                    },
                ],
            },
            {
                "id": "iso_a",
                "default": True,
                "source_type": "isolate",
                "source_name": "A1",
                "sequences": [
                    {
                        "_id": "seq_a2",
                        "accession": "NC_010316",
                        "definition": "Abaca bunchy top virus DNA B",
                        "host": "Musa sp.",
                        "segment": "DNA B",
                        "sequence": "GGGGTTTTAA",
                    },
                    {
                        "_id": "seq_a1",
                        "accession": "NC_010315",
                        "definition": "Abaca bunchy top virus DNA A",
                        "host": "Musa sp.",
                        "segment": "DNA A",
                        "sequence": "CCCCAAAATT",
                    },
                ],
            },
        ],
    },
    {
        "_id": "otu_mu",
        "abbreviation": "MU",
        "name": "Mu virus",
        "taxid": 4567,
        "version": 11,
        "schema": [{"name": "RNA 1", "molecule": "ssRNA", "required": True}],
        "isolates": [
            {
                "id": "iso_m",
                "default": True,
                "source_type": "strain",
                "source_name": "M1",
                "sequences": [
                    {
                        "_id": "seq_m1",
                        "accession": "NC_020001",
                        "definition": "Mu virus RNA 1",
                        "host": "Solanum sp.",
                        "segment": "RNA 1",
                        "sequence": "GATTACAGAT",
                    },
                    {
                        "_id": "seq_m0",
                        "accession": "NC_020000",
                        "definition": "Mu virus unplaced contig",
                        "host": None,
                        "segment": None,
                        "sequence": "TACGTACGTA",
                    },
                ],
            },
        ],
    },
]

OTU_SEQUENCE_QUERY_IDS = ["otu_zeta", "otu_alpha"]

OTU_REF_QUERY_IDS = ["seq_m1", "seq_a1", "seq_z1"]


async def collect(iterator):
    return [item async for item in iterator]


async def main() -> None:
    sqlite_path = HERE / INDEX_SQLITE_FILE_NAME

    if sqlite_path.exists():
        sqlite_path.unlink()

    index = await WFIndex.create(1, sqlite_path, REFERENCE, iter(OTUS))

    fasta_path = HERE / "default.fa"
    await index.write_fasta(fasta_path, index.iter_default_sequences())

    golden = {
        "referenceMetadata": await index.get_reference_metadata(),
        "otus": await collect(index.iter_otus()),
        "sequences": await collect(index.iter_sequences()),
        "defaultSequences": await collect(index.iter_default_sequences()),
        "otuSequences": {
            "otuIds": OTU_SEQUENCE_QUERY_IDS,
            "result": await collect(index.iter_otu_sequences(OTU_SEQUENCE_QUERY_IDS)),
        },
        "otuRefsBySequenceId": {
            "sequenceIds": OTU_REF_QUERY_IDS,
            "result": await index.get_otu_refs_by_sequence_ids(OTU_REF_QUERY_IDS),
        },
    }

    (HERE / "golden.json").write_text(
        json.dumps(golden, indent="\t", sort_keys=True) + "\n",
    )


if __name__ == "__main__":
    asyncio.run(main())
