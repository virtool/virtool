import os

import pytest
from syrupy import snapshot

from virtool.analyses.models import SQLAnalysisFile
from virtool.pg.utils import get_row_by_id
from tests.analyses.test_api import files


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, 400, 404, 422])
async def test_upload_file(error, files, spawn_job_client, tmp_path, data_layer):
    """
    Test that an analysis result file is properly uploaded and a row is inserted into the `analysis_files` SQL table.

    """
    client = await spawn_job_client(authorize=True)

    if error is None:
        format_ = "fasta"
        await client.db.analyses.insert_one(
            {"_id": "foobar", "ready": True, "job": {"id": "hello"}}
        )
        resp = await client.put(
            f"/analyses/foobar/files?name=reference.fa&format={format_}", data=files
        )
        assert resp.status == 201
        assert await resp.json() == snapshot
        assert os.listdir(tmp_path / "analyses") == ["1-reference.fa"]
        assert await get_row_by_id(data_layer.analysis.pg, SQLAnalysisFile, 1)
