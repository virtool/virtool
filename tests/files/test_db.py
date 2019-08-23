import arrow
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.files.db
import virtool.utils


@pytest.fixture
def gen_file_id(mocker):
    return mocker.patch("virtool.files.db.generate_file_id", make_mocked_coro("foo"))


@pytest.fixture
def expected(static_time):
    class Expected:

        def __init__(self):
            self.inserted = {
                "_id": "foo",
                "name": "test.fq.gz",
                "type": "reads",
                "user": None,
                "uploaded_at": static_time.datetime,
                "expires_at": None,
                "created": False,
                "reserved": False,
                "ready": False
            }

        @property
        def returned(self):
            data = {
                **self.inserted,
                "id": "foo",
            }

            del data["_id"]
            del data["expires_at"]
            del data["created"]

            return data

    return Expected()


@pytest.mark.parametrize("exists", [True, False])
async def test_generate_id(exists, mocker, dbi):
    """
    Test that a unique file id is returned even when the first attempt generates an already existing file id.

    """
    m = mocker.Mock(side_effect=["foo", "bar"])

    async def m_get_new_id(db):
        return m(db)

    if exists:
        await dbi.files.insert_one({
            "_id": "foo-test.fq.gz"
        })

    mocker.patch("virtool.db.utils.get_new_id", new=m_get_new_id)

    file_id = await virtool.files.db.generate_file_id(dbi, "test.fq.gz")

    if exists:
        assert file_id == "bar-test.fq.gz"
        return

    assert file_id == "foo-test.fq.gz"


class TestCreate:

    async def test(self, dbi, expected, gen_file_id, static_time):
        document = await virtool.files.db.create(
            dbi,
            "test.fq.gz",
            "reads"
        )

        assert document == expected.returned
        assert await dbi.files.find_one() == expected.inserted

    @pytest.mark.parametrize("reserved", [True, False])
    async def test_reserved(self, reserved, dbi, expected, gen_file_id):
        document = await virtool.files.db.create(
            dbi,
            "test.fq.gz",
            "reads",
            reserved=reserved
        )

        expected.inserted["reserved"] = reserved

        assert document == expected.returned
        assert await dbi.files.find_one() == expected.inserted

    async def test_user(self, dbi, expected, gen_file_id):
        document = await virtool.files.db.create(
            dbi,
            "test.fq.gz",
            "reads",
            user_id="bob"
        )

        expected.inserted["user"] = {
            "id": "bob"
        }

        assert document == expected.returned
        assert await dbi.files.find_one() == expected.inserted

    async def test_otus(self, dbi, expected, gen_file_id, static_time):
        document = await virtool.files.db.create(
            dbi,
            "test.fq.gz",
            "otus",
        )

        expected.inserted["expires_at"] = arrow.get(static_time.datetime).shift(hours=+5).naive
        expected.inserted["type"] = "otus"

        assert document == expected.returned
        assert await dbi.files.find_one() == expected.inserted


@pytest.mark.parametrize("exists", [True, False])
async def test_remove(exists, mocker, tmpdir, dbi):
    f = tmpdir.join("foo-test.fq")
    f.write("hello world")

    m_join_file_path = mocker.patch("virtool.files.utils.join_file_path", return_value=str(f))
    m_run_in_thread = make_mocked_coro()

    if not exists:
        m_run_in_thread.side_effect = FileNotFoundError

    settings = {
        "data_path": "/virtool"
    }

    await virtool.files.db.remove(
        dbi,
        settings,
        m_run_in_thread,
        "foo-test.fq"
    )

    m_run_in_thread.assert_called_with(virtool.utils.rm, str(f))


async def test_reserve(dbi):
    files = [
        {"_id": "foo", "reserved": False},
        {"_id": "bar", "reserved": False},
        {"_id": "baz", "reserved": False}
    ]

    await dbi.files.insert_many(files)

    await virtool.files.db.reserve(dbi, ["foo", "baz"])

    files[0]["reserved"] = True
    files[2]["reserved"] = True

    assert await dbi.files.find().sort("_id").to_list(None) == [
        files[1],
        files[2],
        files[0]
    ]
