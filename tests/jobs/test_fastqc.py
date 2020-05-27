import aiohttp.test_utils
import pytest
import virtool.jobs.fastqc


@pytest.mark.parametrize("paired", [True, False])
async def test_run_fastqc(paired, mocker):
    read_paths = [
        "/reads/reads_1.fq.gz"
    ]

    if paired:
        read_paths.append("/reads/reads_2.fq.gz")

    m_run_subprocess = aiohttp.test_utils.make_mocked_coro()

    await virtool.jobs.fastqc.run_fastqc(
        m_run_subprocess,
        4,
        read_paths,
        "/foo/bar/fastqc"
    )

    expected = [
        "fastqc",
        "-f", "fastq",
        "-o", "/foo/bar/fastqc",
        "-t", "4",
        "--extract",
        "/reads/reads_1.fq.gz"
    ]

    if paired:
        expected.append("/reads/reads_2.fq.gz")

    m_run_subprocess.assert_called_with(expected)


@pytest.mark.parametrize("split_line,result", [
    (["120-125", "NaN", "4.0", "8", "NaN"], [4, 4, 4, 4]),
    (["120-125", "NaN", "NaN", "NaN", "NaN"], [0, 0, 0, 0])
])
def test_handle_base_quality_nan(split_line, result):
    assert virtool.jobs.fastqc.handle_base_quality_nan(split_line) == result
