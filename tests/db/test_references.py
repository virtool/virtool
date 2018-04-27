import gzip
import json
import os
import shutil
import sys

from aiohttp.test_utils import make_mocked_coro

import virtool.db.references

TEST_IMPORT_FILE_PATH = os.path.join(sys.path[0], "tests", "test_files", "files", "import.json.gz")


async def test_import(mocker, tmpdir, test_motor, test_dispatch, static_time):

    with gzip.open(TEST_IMPORT_FILE_PATH, "rt") as f:
        data = json.load(f)

    app = {
        "db": test_motor,
        "dispatch": test_dispatch,
        "run_in_thread": make_mocked_coro(return_value=data)
    }

    shutil.copy(TEST_IMPORT_FILE_PATH, str(tmpdir))

    m = mocker.patch("virtool.db.processes.update", make_mocked_coro())

    await virtool.db.references.import_file(
        app,
        os.path.join(str(tmpdir), "import.json.gz"),
        "bar",
        static_time,
        "foo",
        "bob"
    )

    m.assert_has_calls([
        mocker.call(test_motor, test_dispatch, "foo", 0.2, "validate_documents"),
        mocker.call(test_motor, test_dispatch, "foo", 0.4, "import_documents"),
        mocker.call(test_motor, test_dispatch, "foo", 0.7, "create_history"),
        mocker.call(test_motor, test_dispatch, "foo", 1)
    ])
