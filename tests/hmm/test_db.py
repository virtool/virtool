import json

from virtool.hmm.db import generate_annotations


async def test_generate_annotations(pg, seed_pg_hmm, hmm_document):
    """Annotations are generated from the Postgres ``hmms`` table, addressed by their
    integer primary key.
    """
    await seed_pg_hmm({**hmm_document, "_id": "first", "hidden": False})
    await seed_pg_hmm({**hmm_document, "_id": "second", "hidden": False})

    result = await generate_annotations(pg)

    hmms = json.loads(result)

    assert [document["id"] for document in hmms] == [1, 2]
