import gzip
import json
from http import HTTPStatus

import pytest

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from virtool.fake.next import DataFaker


@pytest.fixture
async def fake_hmm_status(seed_hmm_status, fake: DataFaker, static_time):
    user = await fake.users.create()

    document = {
        "_id": "hmm",
        "updating": False,
        "updates": [
            {
                "body": "- remove some annotations that didn't have corresponding profiles",
                "created_at": static_time.datetime,
                "filename": "vthmm.tar.gz",
                "html_url": "https://github.com/virtool/virtool-hmm/releases/tag/v0.2.1",
                "id": 1230982,
                "name": "v0.2.1",
                "newer": False,
                "published_at": static_time.datetime,
                "ready": True,
                "size": 85904451,
                "user": {"id": user.id},
            },
        ],
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

    await seed_hmm_status(document)

    return user


async def test_find(
    fake_hmm_status,
    snapshot,
    seed_pg_hmm,
    spawn_client: ClientSpawner,
    hmm_document,
):
    """Check that a request with no URL parameters returns a list of HMM annotation documents read from Postgres."""
    client = await spawn_client(authenticated=True)

    await seed_pg_hmm({**hmm_document, "hidden": False})

    resp = await client.get("/hmms")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


async def test_get_status(fake_hmm_status, snapshot, spawn_client, static_time):
    client = await spawn_client(authenticated=True)
    resp = await client.get("/hmms/status")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(name="json")


async def test_get_release(fake_hmm_status, spawn_client, snapshot):
    """Test that the endpoint returns the latest HMM release. Check that error responses are sent in all expected
    situations.

    """
    client = await spawn_client(authenticated=True)

    resp = await client.get("/hmms/status/release")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(name="json")


async def test_list_updates(fake_hmm_status, spawn_client, snapshot):
    """The endpoint lists the status updates newest-first from Postgres."""
    client = await spawn_client(authenticated=True)

    resp = await client.get("/hmms/status/updates")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(name="json")


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error,
    snapshot,
    seed_pg_hmm,
    spawn_client: ClientSpawner,
    hmm_document,
    resp_is,
):
    """Check that a ``GET`` request for a valid annotation document results in a response containing that complete
    document read from Postgres.

    Check that a `404` is returned if the HMM does not exist.

    """
    client = await spawn_client(authenticated=True)

    if not error:
        await seed_pg_hmm(hmm_document)

    resp = await client.get("/hmms/f8666902")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(name="json")


async def test_get_hmm_annotations(
    seed_pg_hmm,
    spawn_job_client: JobClientSpawner,
    hmm_document,
):
    """The annotations file is regenerated from the Postgres ``hmms`` table."""
    client = await spawn_job_client(authenticated=True)

    await seed_pg_hmm({**hmm_document, "hidden": False})

    async with client.get("/hmms/files/annotations.json.gz") as response:
        assert response.status == HTTPStatus.OK

        compressed_bytes = await response.read()

    decompressed = gzip.decompress(compressed_bytes)
    hmms = json.loads(decompressed)

    assert hmms == [
        {
            "id": "f8666902",
            "cluster": 3463,
            "count": 4,
            "length": 199,
            "mean_entropy": 0.51,
            "total_entropy": 101.49,
            "hidden": False,
            "names": ["ORF-63", "ORF67", "hypothetical protein"],
            "families": {"Baculoviridae": 3},
            "genera": {"Alphabaculovirus": 3},
            "entries": hmm_document["entries"],
        },
    ]


@pytest.mark.parametrize("file_exists", [True, False])
async def test_get_hmm_profiles(
    file_exists: bool,
    example_path,
    spawn_job_client: JobClientSpawner,
):
    """Test that HMM profiles can be properly downloaded once they are available."""
    client = await spawn_job_client(authenticated=True)

    if file_exists:
        profile_bytes = (example_path / "hmms" / "profiles.hmm").read_bytes()

        async def _data():
            yield profile_bytes

        await client.app["storage"].write("hmm/profiles.hmm", _data())

    resp = await client.get("/hmms/files/profiles.hmm")

    if file_exists:
        assert resp.status == HTTPStatus.OK
        assert await resp.content.read() == profile_bytes
    else:
        assert resp.status == HTTPStatus.NOT_FOUND
