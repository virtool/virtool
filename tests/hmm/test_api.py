import gzip
import json
from http import HTTPStatus

import pytest

from tests.fixtures.client import JobClientSpawner
from tests.fixtures.response import RespIs


async def test_get(
    snapshot,
    seed_pg_hmm,
    spawn_job_client: JobClientSpawner,
    hmm_document,
):
    """A ``GET`` for an annotation by its integer id returns the complete document read
    from Postgres.
    """
    client = await spawn_job_client(authenticated=True)

    await seed_pg_hmm(hmm_document)

    resp = await client.get("/hmms/1")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(name="json")


async def test_get_not_found(spawn_job_client: JobClientSpawner, resp_is: RespIs):
    """A ``GET`` for an id with no matching annotation returns ``404``."""
    client = await spawn_job_client(authenticated=True)

    resp = await client.get("/hmms/999999")

    await resp_is.not_found(resp)


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
            "id": 1,
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
