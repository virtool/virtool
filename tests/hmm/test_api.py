import json
import shutil

import aiofiles
import pytest
from aiohttp import ClientConnectorError
from aiohttp.test_utils import make_mocked_coro
from virtool_core.utils import decompress_file

from virtool.errors import GitHubError


@pytest.fixture
async def fake_hmm_status(dbi, fake2, static_time):
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

    return user


async def test_find(fake_hmm_status, snapshot, spawn_client, hmm_document):
    """
    Check that a request with no URL parameters returns a list of HMM annotation documents.

    """
    client = await spawn_client(authorize=True)

    hmm_document["hidden"] = False

    await client.db.hmm.insert_one(hmm_document)

    resp = await client.get("/hmms")

    assert resp.status == 200
    assert await resp.json() == snapshot


async def test_get_status(fake_hmm_status, snapshot, spawn_client, static_time):
    client = await spawn_client(authorize=True)
    resp = await client.get("/hmms/status")

    assert resp.status == 200
    assert await resp.json() == snapshot(name="json")


@pytest.mark.parametrize("error", [None, "502_repo", "502_github", "404"])
async def test_get_release(error, mocker, spawn_client, resp_is, snapshot, static_time):
    """
    Test that the endpoint returns the latest HMM release. Check that error responses are sent in all expected
    situations.

    """
    client = await spawn_client(authorize=True)

    m_fetch = make_mocked_coro(
        None
        if error == "404"
        else {
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
    )

    mocker.patch("virtool.hmm.db.fetch_and_update_release", new=m_fetch)

    if error == "502_repo":
        m_fetch.side_effect = GitHubError("404 Not found")

    if error == "502_github":
        m_fetch.side_effect = ClientConnectorError("foo", OSError("Bar"))

    resp = await client.get("/hmms/status/release")

    m_fetch.assert_called_with(
        client.app["config"], client.app["client"], client.db, "virtool/virtool-hmm"
    )

    if error == "404":
        await resp_is.not_found(resp, "Not found")
        return

    if error == "502_repo":
        await resp_is.bad_gateway(resp, "GitHub repository does not exist")
        return

    if error == "502_github":
        await resp_is.bad_gateway(resp, "Could not reach GitHub")
        return

    assert resp.status == 200
    assert await resp.json() == snapshot(name="json")


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, snapshot, spawn_client, hmm_document, resp_is):
    """
    Check that a ``GET`` request for a valid annotation document results in a response containing that complete
    document.

    Check that a `404` is returned if the HMM does not exist.

    """
    client = await spawn_client(authorize=True)

    if not error:
        await client.db.hmm.insert_one(hmm_document)

    resp = await client.get("/hmms/f8666902")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot(name="json")


async def test_get_hmm_annotations(spawn_job_client, tmp_path):
    client = await spawn_job_client(authorize=True)
    client.app["config"].data_path = tmp_path
    db = client.app["db"]

    await db.hmm.insert_one({"_id": "foo"})
    await db.hmm.insert_one({"_id": "bar"})

    compressed_hmm_annotations = tmp_path / "annotations.json.gz"
    decompressed_hmm_annotations = tmp_path / "annotations.json"

    async with client.get("/hmms/files/annotations.json.gz") as response:
        assert response.status == 200

        async with aiofiles.open(compressed_hmm_annotations, "wb") as f:
            await f.write(await response.read())

        decompress_file(compressed_hmm_annotations, decompressed_hmm_annotations)

        async with aiofiles.open(decompressed_hmm_annotations, "r") as f:
            hmms = json.loads(await f.read())

        assert hmms == [{"id": "foo"}, {"id": "bar"}]


@pytest.mark.parametrize("data_exists", [True, False])
@pytest.mark.parametrize("file_exists", [True, False])
async def test_get_hmm_profiles(
    data_exists,
    file_exists,
    snapshot,
    example_path,
    spawn_client,
    spawn_job_client,
    tmp_path,
):
    """
    Test that HMM profiles can be properly downloaded once they are available.

    """
    client = await spawn_job_client(authorize=True)

    client.app["config"].data_path = tmp_path
    hmms_path = tmp_path / "hmm"
    profiles_path = hmms_path / "profiles.hmm"

    if data_exists:
        hmms_path.mkdir()

        if file_exists:
            shutil.copy(example_path / "hmms" / "profiles.hmm", hmms_path)
            assert profiles_path.exists()

    resp = await client.get("/hmms/files/profiles.hmm")

    if data_exists and file_exists:
        assert resp.status == 200
        assert profiles_path.read_bytes() == await resp.content.read()
    else:
        assert resp.status == 404
