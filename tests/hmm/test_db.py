import json

from virtool.hmm.db import generate_annotations
from virtool.mongo.core import Mongo


async def test_generate_annotations(mongo: Mongo):
    await mongo.hmm.insert_one({"_id": "foo"})
    await mongo.hmm.insert_one({"_id": "bar"})

    result = await generate_annotations(mongo)

    hmms = json.loads(result)

    ids = [document["id"] for document in hmms]

    assert "foo" in ids
    assert "bar" in ids
