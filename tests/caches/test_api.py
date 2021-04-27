import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.caches.models import SampleArtifactCache, SampleReadsCache


@pytest.mark.parametrize("error", [None, "404_artifact", "404_file", "404_cache"])
async def test_download_artifact_cache(error, spawn_job_client, pg, tmp_path):
    """
    Test that a sample artifact cache can be downloaded using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path

    key = "aodp-abcdefgh"
    name = "fastqc.txt"
    name_on_disk = "1-fastqc.txt"

    if error != "404_file":
        path = tmp_path / "caches" / key
        path.mkdir(parents=True)
        path.joinpath(name_on_disk).write_text("text")

    if error != "404_artifact":
        sample_artfact_cache = SampleArtifactCache(id=1, sample="foo", name=name, name_on_disk=name_on_disk,
                                                   type="fastq", key="aodp-abcdefgh")

        async with AsyncSession(pg) as session:
            session.add(sample_artfact_cache)

            await session.commit()

    if error != "404_cache":
        await client.db.caches.insert_one({
            "key": key,
            "sample": {
                "id": "foo"
            }
        })

    resp = await client.get(f"/api/caches/{key}/artifacts/{name}")

    expected_path = client.app["settings"]["data_path"] / "caches" / key / name_on_disk

    if error:
        assert resp.status == 404
    else:
        assert resp.status == 200
        assert expected_path.read_bytes() == await resp.content.read()


@pytest.mark.parametrize("error", [None, "404_reads", "404_file", "404_cache"])
async def test_download_reads_cache(error, spawn_job_client, pg, tmp_path):
    """
    Test that a sample reads cache can be downloaded using the Jobs API.

    """
    client = await spawn_job_client(authorize=True)

    client.app["settings"]["data_path"] = tmp_path

    filename = "reads_1.fq.gz"
    key = "aodp-abcdefgh"

    if error != "404_file":
        path = tmp_path / "caches" / key
        path.mkdir(parents=True)
        path.joinpath(filename).write_text("test")

    if error != "404_cache":
        await client.db.caches.insert_one({
            "key": key,
            "sample": {
                "id": "foo"
            }
        })

    if error != "404_reads":
        sample_reads_cache = SampleReadsCache(id=1, sample="foo", name=filename, name_on_disk=filename, key="aodp-abcdefgh")

        async with AsyncSession(pg) as session:
            session.add(sample_reads_cache)
            await session.commit()

    resp = await client.get(f"/api/caches/{key}/reads/{filename}")

    expected_path = client.app["settings"]["data_path"] / "caches" / key / filename

    if error:
        assert resp.status == 404
    else:
        assert resp.status == 200
        assert expected_path.read_bytes() == await resp.content.read()
