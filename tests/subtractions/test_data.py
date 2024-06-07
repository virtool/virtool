from syrupy import SnapshotAssertion

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.subtractions.oas import FinalizeSubtractionRequest


async def test_finalize(
    data_layer: DataLayer,
        fake: DataFaker,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    static_time,
):
    user = await fake.users.create()
    job = await fake.jobs.create(user)

    await mongo.subtraction.insert_one(
        {
            "_id": "apple",
            "created_at": static_time.datetime,
            "file": {
                "id": 642,
                "name": "malus.fa.gz",
            },
            "gc": None,
            "count": None,
            "has_file": True,
            "name": "Malus",
            "nickname": "Apple",
            "deleted": False,
            "ready": False,
            "user": {"id": user.id},
            "job": {"id": job.id},
        },
    )

    subtraction = await data_layer.subtractions.finalize(
        "apple",
        FinalizeSubtractionRequest(
            gc={"a": 0.319, "t": 0.319, "g": 0.18, "c": 0.18, "n": 0.002}, count=100,
        ),
    )

    assert subtraction == snapshot(name="obj")
    assert await mongo.subtraction.find_one() == snapshot(name="mongo")
