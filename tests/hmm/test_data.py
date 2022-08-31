from aiohttp.test_utils import make_mocked_coro


async def test_get_status(config, data_layer, fake2, dbi, snapshot, static_time, tasks):
    """
    Test that function works when the HMM data are being updated and when they are not.

    """
    user = await fake2.users.create()

    await dbi.status.insert_one(
        {
            "_id": "hmm",
            "updating": False,
            "updates": [{"id": 231}],
            "installed": {
                "body": "- remove some annotations that didn't have corresponding profiles",
                "created_at": static_time.datetime,
                "filename": "vthmm.tar.gz",
                "html_url": "https://github.com/virtool/virtool-hmm/releases/tag/v0.2.1",
                "id": 8472569,
                "name": "v0.2.1",
                "newer": True,
                "published_at": "2017-11-10T19:12:43Z",
                "ready": True,
                "size": 85904451,
                "user": {"id": user.id},
            },
            "release": {
                "body": "- remove some annotations that didn't have corresponding profiles",
                "content_type": "application/gzip",
                "download_url": "https://github.com/virtool/virtool-hmm/releases/download/v0.2.1/vthmm.tar.gz",
                "etag": 'W/"7bd9cdef79c82ab4d7e5cfff394cf81eaddc6f681b8202f2a7bdc65cbcc4aaea"',
                "filename": "vthmm.tar.gz",
                "html_url": "https://github.com/virtool/virtool-hmm/releases/tag/v0.2.1",
                "id": 1230982,
                "name": "v0.2.1",
                "newer": False,
                "published_at": static_time.datetime,
                "retrieved_at": static_time.datetime,
                "size": 85904451,
            },
            "errors": [],
        }
    )

    assert await data_layer.hmms.get_status() == snapshot


async def test_purge(dbi, data_layer, mocker, tmp_path, config, static_time):
    """
    Test that the function calls `delete_unreferenced_hmms()` and hides all remaining
    HMM documents.

    """
    mocker.patch(
        "virtool.hmm.db.get_referenced_hmm_ids", make_mocked_coro(["b", "e", "f"])
    )

    mocker.patch(
        "virtool.hmm.db.fetch_and_update_release",
        make_mocked_coro(
            {
                "body": "- remove some annotations that didn't have corresponding profiles",
                "content_type": "application/gzip",
                "download_url": "https://github.com/virtool/virtool-hmm/releases/download/v0.2.1/vthmm.tar.gz",
                "etag": 'W/"7bd9cdef79c82ab4d7e5cfff394cf81eaddc6f681b8202f2a7bdc65cbcc4aaea"',
                "filename": "vthmm.tar.gz",
                "html_url": "https://github.com/virtool/virtool-hmm/releases/tag/v0.2.1",
                "id": 1230982,
                "name": "v0.2.1",
                "newer": False,
                "published_at": static_time.datetime,
                "retrieved_at": static_time.datetime,
                "size": 85904451,
            }
        ),
    )

    await dbi.hmm.insert_many(
        [
            {"_id": "a"},
            {"_id": "b"},
            {"_id": "c"},
            {"_id": "d"},
            {"_id": "e"},
            {"_id": "f"},
        ]
    )

    await data_layer.settings.ensure()
    await data_layer.hmms.purge()

    assert await dbi.hmm.find().sort("_id").to_list(None) == [
        {"_id": "b", "hidden": True},
        {"_id": "e", "hidden": True},
        {"_id": "f", "hidden": True},
    ]
