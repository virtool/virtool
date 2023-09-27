from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.subtractions.oas import FinalizeSubtractionRequest


async def test_finalize(
    data_layer: DataLayer, fake2: DataFaker, mongo: Mongo, snapshot, static_time
):
    user = await fake2.users.create()
    job = await fake2.jobs.create(user)

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
        }
    )

    subtraction = await data_layer.subtractions.finalize(
        "apple",
        FinalizeSubtractionRequest(
            **{
                "gc": {"a": 0.319, "t": 0.319, "g": 0.18, "c": 0.18, "n": 0.002},
                "count": 100,
            }
        ),
    )

    assert subtraction == snapshot(name="obj")
    assert await mongo.subtraction.find_one() == snapshot(name="mongo")
