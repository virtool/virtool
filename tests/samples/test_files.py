import os

import pytest
from sqlalchemy import select

from virtool.samples.files import create_reads_file
from virtool.samples.models import SampleReads
from virtool.samples.fake import READ_FILES_PATH


@pytest.mark.parametrize("copy_file", [True, False])
async def test_create_reads_file(copy_file, run_in_thread, tmp_path, pg, pg_session, static_time):
    app = {
        "pg": pg,
        "settings": {
            "data_path": tmp_path
        },
        "run_in_thread": run_in_thread
    }

    file_path = READ_FILES_PATH / "single.fq.gz"

    if copy_file:
        await create_reads_file(
            app,
            file_path.stat().st_size,
            "reads.fq.gz",
            "reads.fq.gz",
            "sample_1",
            path=file_path,
            copy_file=True
        )
    else:
        await create_reads_file(
            app,
            123456,
            "reads_1.fq.gz",
            "reads_1.fq.gz",
            "sample_1",
        )

    async with pg_session as session:
        result = (await session.execute(select(SampleReads).filter_by(id=1))).scalar()

    if copy_file:
        assert result.to_dict() == {
            "id": 1,
            "sample": "sample_1",
            "name": "reads.fq.gz",
            "name_on_disk": "reads.fq.gz",
            "size": file_path.stat().st_size,
            "upload": None,
            "uploaded_at": static_time.datetime
        }
        assert os.listdir(app["settings"]["data_path"] / "samples" / "sample_1") == ["reads.fq.gz"]
    else:
        assert result.to_dict() == {
            "id": 1,
            "sample": "sample_1",
            "name": "reads_1.fq.gz",
            "name_on_disk": "reads_1.fq.gz",
            "size": 123456,
            "upload": None,
            "uploaded_at": static_time.datetime
        }
