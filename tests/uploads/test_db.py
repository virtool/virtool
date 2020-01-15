import virtool.uploads.db


async def test_finish_upload(mocker, dbi):
    app = {
        "db": dbi,
        "settings": {
            "data_path": "/foo"
        }
    }

    stats = {
        "size": 2048
    }

    await dbi.files.insert_one({
        "_id": "bar",
        "ready": False
    })

    mocker.patch("virtool.utils.file_stats", return_value=stats)

    await virtool.uploads.db.finish_upload(app, "bar")

    assert await dbi.files.find_one() == {
        "_id": "bar",
        "size": 2048,
        "ready": True
    }


