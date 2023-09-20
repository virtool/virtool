import os

import pytest
from syrupy import snapshot
from syrupy.filters import props

from virtool.analyses.models import SQLAnalysisFile
from virtool.config import get_config_from_app
from virtool.pg.utils import get_row_by_id
from tests.analyses.test_api import files


@pytest.mark.apitest
async def test_upload_file(files, spawn_job_client, tmp_path, data_layer, snapshot):
    """
    Test that an analysis result file is properly uploaded and a row is inserted into the `analysis_files` SQL table.

    """
    client = await spawn_job_client(authorize=True)
    get_config_from_app(client.app).data_path = tmp_path
    format_ = "fasta"
    await client.db.analyses.insert_one(
        {"_id": "foobar", "ready": True, "job": {"id": "hello"}}
    )
    resp = await client.put(
        f"/analyses/foobar/files?name=reference.fa&format={format_}", data=files
    )
    assert resp.status == 201
    assert await resp.json() == snapshot(exclude=props("uploaded_at"))
    assert os.listdir(tmp_path / "analyses") == ["1-reference.fa"]
    assert await get_row_by_id(data_layer.analyses._pg, SQLAnalysisFile, 1)
