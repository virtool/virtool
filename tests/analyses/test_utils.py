import os

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


@pytest.mark.parametrize("coverage,expected", [
    (
            [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2],
            [(0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (5, 3), (7, 3), (8, 4), (9, 4), (10, 3), (11, 2)]
    ),
    (
            [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2, 1, 1],
            [(0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (5, 3), (7, 3), (8, 4), (9, 4), (10, 3), (11, 2), (12, 1), (13, 1)]
    )
])
def test_collapse_pathoscope_coverage(coverage, expected):
    """
    Test that two sample coverage data sets are correctly converted to coordinates.

    """
    assert virtool.analyses.utils.transform_coverage_to_coordinates(coverage) == expected


@pytest.mark.parametrize("name", ["nuvs", "pathoscope"])
def test_get_json_path(name):
    """
    Test that the function can correctly extrapolate the path to a nuvs.json file given the `data_path`, `sample_id`,
    and `analysis_id` arguments.

    """
    path = virtool.analyses.utils.join_analysis_json_path("/data", "bar", "foo")
    assert path == "/data/samples/foo/analysis/bar/results.json"


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


async def test_move_nuvs_files(tmpdir, spawn_client):
    client = await spawn_client(authorize=True)

    file_path = tmpdir.mkdir("files")
    file_path.join("hmm.tsv").write("HMM file")
    file_path.join("assembly.fa").write("FASTA file")

    target_path = tmpdir.mkdir("analyses")

    await virtool.analyses.utils.move_nuvs_files("hmm.tsv", client.app["run_in_thread"], file_path, target_path)
    assert set(os.listdir(target_path)) == {"hmm.tsv"}

    await virtool.analyses.utils.move_nuvs_files("assembly.fa", client.app["run_in_thread"], file_path, target_path)
    assert set(os.listdir(target_path)) == {"hmm.tsv", "assembly.fa.gz"}
