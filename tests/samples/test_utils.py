import pytest

import virtool.samples


def test_join_read_path():
    assert virtool.samples.utils.join_read_path("/mnt/data/foo", 1) == "/mnt/data/foo/reads_1.fq.gz"


@pytest.mark.parametrize("paired,paths", [
    (True, ["/mnt/foo/bar/reads_1.fq.gz", "/mnt/foo/bar/reads_2.fq.gz"]),
    (False, ["/mnt/foo/bar/reads_1.fq.gz"])
])
def test_join_read_paths(paired, paths):
    assert virtool.samples.utils.join_read_paths("/mnt/foo/bar", paired) == paths
