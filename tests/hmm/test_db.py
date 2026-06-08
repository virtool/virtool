import json

from virtool.hmm.db import generate_annotations


async def test_generate_annotations(pg, seed_pg_hmm, hmm_document):
    """Annotations are generated from the Postgres ``hmms`` table."""
    await seed_pg_hmm({**hmm_document, "_id": "foo", "hidden": False})
    await seed_pg_hmm({**hmm_document, "_id": "bar", "hidden": False})

    result = await generate_annotations(pg)

    hmms = json.loads(result)

    ids = [document["id"] for document in hmms]

    assert "foo" in ids
    assert "bar" in ids
