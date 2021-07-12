import os
from pathlib import Path

import pytest

import virtool.analyses.db
import virtool.analyses.utils
import virtool.analyses.files


@pytest.mark.parametrize("exists", [True, False])
async def test_attach_analysis_files(exists, dbi, spawn_client, snapshot, pg):
    client = await spawn_client(authorize=True)

    await client.db.analyses.insert_one({
        "_id": "foobar",
        "ready": True,
    })

    if exists:
        await virtool.analyses.files.create_analysis_file(pg, "foobar", "fasta", "reference-fa")

    document = await dbi.analyses.find_one("foobar")

    document = await virtool.analyses.utils.attach_analysis_files(pg, "foobar", document)

    snapshot.assert_match(document)


@pytest.mark.parametrize("name", ["nuvs", "pathoscope"])
def test_get_json_path(name):
    """
    Test that the function can correctly extrapolate the path to a nuvs.json file given the `data_path`, `sample_id`,
    and `analysis_id` arguments.

    """
    path = virtool.analyses.utils.join_analysis_json_path(Path("data"), "bar", "foo")
    assert path == Path("data/samples/foo/analysis/bar/results.json")


@pytest.mark.parametrize("file_type", ["fasta", "fastq", "tsv"])
async def test_check_nuvs_file_type(file_type):
    if file_type == "fasta":
        result = virtool.analyses.utils.check_nuvs_file_type("assembly.fa")
        assert result == "fasta"

    if file_type == "fastq":
        result = virtool.analyses.utils.check_nuvs_file_type("unmapped_hosts.fq")
        assert result == "fastq"

    if file_type == "tsv":
        result = virtool.analyses.utils.check_nuvs_file_type("hmm.tsv")
        assert result == "tsv"


async def test_move_nuvs_files(tmp_path, spawn_client):
    client = await spawn_client(authorize=True)

    file_path = tmp_path.joinpath("files")
    file_path.mkdir()
    file_path.joinpath("hmm.tsv").write_text("HMM file")
    file_path.joinpath("assembly.fa").write_text("FASTA file")

    target_path = tmp_path.joinpath("analyses")
    target_path.mkdir()

    await virtool.analyses.utils.move_nuvs_files("hmm.tsv", client.app["run_in_thread"], file_path, target_path)
    assert set(os.listdir(target_path)) == {"hmm.tsv"}

    await virtool.analyses.utils.move_nuvs_files("assembly.fa", client.app["run_in_thread"], file_path, target_path)
    assert set(os.listdir(target_path)) == {"hmm.tsv", "assembly.fa.gz"}
