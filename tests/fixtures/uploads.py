from pathlib import Path

import pytest

from virtool.uploads.models import Upload


@pytest.fixture
def files(tmpdir):
    tmpdir.mkdir("files")

    path = Path.cwd() / "tests" / "test_files" / "test.fq.gz"

    files = {
        "file": open(path, "rb")
    }

    return files


@pytest.fixture
async def prepare_pg(pg_session, static_time):
    upload_1 = Upload(id=1, name="test.fq.gz", type="reads", user="danny")
    upload_2 = Upload(id=2, name="test.fq.gz", type="reference", user="lester")
    upload_3 = Upload(id=3, name="test.fq.gz", user="jake")

    async with pg_session as session:
        session.add_all([upload_1, upload_2, upload_3])

        await session.commit()
