import asyncio
import concurrent.futures
import os
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.files


@pytest.fixture
def test_manager_instance(loop, test_motor, test_dispatch, tmpdir):
    files_path = str(tmpdir.mkdir("files"))
    watch_path = str(tmpdir.mkdir("watch"))

    executor = concurrent.futures.ThreadPoolExecutor()

    manager = virtool.files.Manager(loop, executor, test_motor, test_dispatch, files_path, watch_path)

    return manager


@pytest.fixture
def patched_test_manager_instance(monkeypatch, test_manager_instance):
    for key in ["handle_watch_close", "handle_file_close", "handle_file_creation", "handle_file_deletion"]:
        monkeypatch.setattr(test_manager_instance, key, make_mocked_coro())

    test_manager_instance.start()

    yield test_manager_instance

    test_manager_instance.loop.run_until_complete(test_manager_instance.close())


def touch(path):
    with open(path, "w") as f:
        f.write("hello world")


@pytest.mark.parametrize("filename,expected", [
    ("test.fq.gz", True),
    ("test.fastq.gz", True),
    ("test.fq", True),
    ("test.fastq", True),
    ("test.fa.gz", False),
    ("test.zip", False),
    ("test.fa", False),
    ("test.gz", False)
])
def test_has_read_extension(filename,expected):
    assert virtool.files.has_read_extension(filename) == expected


@pytest.mark.parametrize("called", [True, False])
async def test_detect_watch(called, patched_test_manager_instance):
    path = patched_test_manager_instance.watch_path if called else patched_test_manager_instance.files_path

    touch(os.path.join(path, "test.fq"))

    await asyncio.sleep(0.1)

    if called:
        patched_test_manager_instance.handle_watch_close.assert_called_with("test.fq")
    else:
        assert patched_test_manager_instance.handle_watch_close.called is False


@pytest.mark.parametrize("called", [True, False])
async def test_detect_create_close_and_delete(called, patched_test_manager_instance):
    """
    Test that calls are made to ``handle_file_creation``, ``handle_file_close``, ``handle_file_deletion`` with the
    filename when appropriate.

    """
    path = patched_test_manager_instance.files_path if called else patched_test_manager_instance.watch_path

    file_path = os.path.join(path, "test.fq")

    touch(file_path)

    await asyncio.sleep(0.1)

    if called:
        patched_test_manager_instance.handle_file_creation.assert_called_with("test.fq")
        patched_test_manager_instance.handle_file_close.assert_called_with("test.fq")
    else:
        assert patched_test_manager_instance.handle_file_creation.called is False
        assert patched_test_manager_instance.handle_file_close.called is False

    os.remove(file_path)

    await asyncio.sleep(0.1)

    if called:
        patched_test_manager_instance.handle_file_deletion.assert_called_with("test.fq")
    else:
        assert patched_test_manager_instance.handle_file_deletion.called is False


@pytest.mark.parametrize("has_ext", [True, False])
async def test_handle_watch_close(has_ext, mocker, test_motor, static_time, test_manager_instance):

    mocker.patch("virtool.db.utils.get_new_id", make_mocked_coro("foobar"))

    mocker.patch("virtool.files.has_read_extension", return_value=has_ext)

    filename = "test.fq" if has_ext else "test.txt"

    touch(os.path.join(test_manager_instance.watch_path, filename))

    await test_manager_instance.handle_watch_close(filename)

    await asyncio.sleep(0.1)

    if has_ext:
        # Check if a new file document was created if the file had a valid extension.
        assert await test_motor.files.find_one() == {
            "_id": "foobar-test.fq",
            "name": "test.fq",
            "type": "reads",
            "user": None,
            "uploaded_at": static_time,
            "expires_at": None,
            "reserved": False,

            # Both of these keys should be ``False`` as the ``CLOSE_WRITE`` and ``CREATE`` flags are not being
            # listened for in the ``test_manager_instance``.
            "created": False,
            "ready": False
        }

    # Make sure the watched file was moved to the files directory ONLY if it had a valid extension.
    assert os.listdir(test_manager_instance.files_path) == (["foobar-test.fq"] if has_ext else [])

    # Make sure watched file was removed, whether it had a valid extension or not.
    assert os.listdir(test_manager_instance.watch_path) == []


@pytest.mark.parametrize("has_document", [True, False])
async def test_handle_file_creation(has_document, test_motor, test_manager_instance):
    filename = "foobar-test.fq"

    path = os.path.join(test_manager_instance.files_path, filename)

    touch(path)

    if has_document:
        await test_motor.files.insert({
            "_id": "foobar-test.fq",
            "created": False
        })

    await test_manager_instance.handle_file_creation(filename)

    document = await test_motor.files.find_one()

    if has_document:
        assert document == {
            "_id": "foobar-test.fq",
            "created": True
        }
    else:
        assert document is None

    assert os.listdir(test_manager_instance.files_path) == [filename]


@pytest.mark.parametrize("has_document", [True, False])
async def test_handle_file_close(has_document, test_motor, test_manager_instance):
    filename = "foobar-test.fq"

    path = os.path.join(test_manager_instance.files_path, filename)

    touch(path)

    if has_document:
        await test_motor.files.insert({
            "_id": filename,
            "ready": False
        })

    await test_manager_instance.handle_file_close(filename)

    document = await test_motor.files.find_one()

    if has_document:
        assert document == {
            "_id": filename,
            "ready": True,
            "size": 11
        }
    else:
        assert document is None
        assert os.listdir(test_manager_instance.files_path) == []


async def test_handle_file_deletion(test_motor, test_manager_instance):
    filename = "foobar-test.fq"

    await test_motor.files.insert({
        "_id": filename,
        "created": True,
        "ready": True
    })

    await test_manager_instance.handle_file_deletion(filename)

    assert not await test_motor.files.count()
