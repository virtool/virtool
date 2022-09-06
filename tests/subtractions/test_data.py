from virtool.subtractions.oas import FinalizeSubtractionRequest


async def test_finalize(dbi, data_layer, fake2, snapshot, static_time):

    user = await fake2.users.create()

    await dbi.subtraction.insert_one(
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
        }
    )

    subtraction = await data_layer.subtractions.finalize(
        "apple",
        FinalizeSubtractionRequest(
            gc={"a": 0.319, "t": 0.319, "g": 0.18, "c": 0.18, "n": 0.002}, count=100
        ),
    )

    assert subtraction == snapshot(name="obj")
    assert await dbi.subtraction.find_one() == snapshot(name="db")
