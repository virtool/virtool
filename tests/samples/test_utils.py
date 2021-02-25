import pytest

import virtool.samples
from virtool.labels.models import Label
from virtool.samples.utils import check_labels


@pytest.fixture()
def labels():
    label_1 = Label(id=1, name="Legacy", color="#83F52C", description="This is a legacy sample")
    label_2 = Label(id=2, name="Bug", color="#83F52C", description="This is a bug")

    return [label_1, label_2]


@pytest.mark.parametrize("exists", [0, 1, 2])
async def test_check_labels(exists, labels, spawn_client, pg_session, pg):
    ids = [label.id for label in labels]

    async with pg_session as session:
        session.add_all(labels[:exists])

        await session.commit()

    bad_labels = await check_labels(pg, ids)

    assert len(bad_labels) == (2 - exists)


def test_join_read_path():
    assert virtool.samples.utils.join_read_path("/mnt/data/foo", 1) == "/mnt/data/foo/reads_1.fq.gz"


@pytest.mark.parametrize("paired,paths", [
    (True, ["/mnt/foo/bar/reads_1.fq.gz", "/mnt/foo/bar/reads_2.fq.gz"]),
    (False, ["/mnt/foo/bar/reads_1.fq.gz"])
])
def test_join_read_paths(paired, paths):
    assert virtool.samples.utils.join_read_paths("/mnt/foo/bar", paired) == paths
