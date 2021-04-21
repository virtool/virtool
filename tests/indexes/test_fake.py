import os

from virtool.fake.wrapper import FakerWrapper
from virtool.indexes.fake import create_fake_indexes
from virtool.indexes.models import IndexFile
from virtool.pg.utils import get_rows


async def test_create_fake_indexes(dbi, pg, snapshot, tmp_path, static_time):
    app = {
        "db": dbi,
        "fake": FakerWrapper(),
        "pg": pg,
        "settings": {
            "data_path": tmp_path,
        }
    }

    await create_fake_indexes(app, "reference_1", "bob")

    rows = [row for row in await get_rows(pg, "2x6YnyMt", IndexFile, "index")]

    snapshot.assert_match(rows, "index_files")
    snapshot.assert_match(await dbi.indexes.find().to_list(None), "indexes")

    assert set(os.listdir(tmp_path / "references" / "reference_1" / "2x6YnyMt")) == {
        "reference.fa.gz",
        "reference.1.bt2",
        "reference.2.bt2",
        "reference.3.bt2",
        "reference.4.bt2",
        "reference.rev.1.bt2",
        "reference.rev.2.bt2",
    }
