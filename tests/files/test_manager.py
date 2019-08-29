import asyncio
import concurrent.futures
import os

import aiojobs
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.files.manager


@pytest.fixture
def test_manager_instance(loop, dbi, tmpdir):
    files_path = str(tmpdir.mkdir("files"))
    watch_path = str(tmpdir.mkdir("watch"))

    executor = concurrent.futures.ThreadPoolExecutor()

    scheduler = loop.run_until_complete(aiojobs.create_scheduler())

    manager = virtool.files.manager.Manager(executor, dbi, files_path, watch_path)

    loop.run_until_complete(scheduler.spawn(manager.run()))

    yield manager

    loop.run_until_complete(scheduler.close())


@pytest.fixture
def patched_test_manager_instance(mocker, test_manager_instance):
    for key in ["handle_watch", "handle_close", "handle_create", "handle_delete"]:
        mocker.patch.object(test_manager_instance, key, make_mocked_coro())

    return test_manager_instance


def touch(path):
    with open(path, "w") as f:
        f.write("hello world")


@pytest.mark.parametrize("called", [True, False])
async def test_detect_watch(called, patched_test_manager_instance):
    """
    Test that handle_watch is called if file is written in files_path, only if in watch_path.

    """
    path = patched_test_manager_instance.watch_path if called else patched_test_manager_instance.files_path

    touch(os.path.join(path, "test.fq"))

    await asyncio.sleep(1)

    if called:
        patched_test_manager_instance.handle_watch.assert_called_with("test.fq")
    else:
        assert not patched_test_manager_instance.handle_watch.called


@pytest.mark.parametrize("called", [True, False])
async def test_detect_create_close_and_delete(called, patched_test_manager_instance):
    """
    Test that calls are made to ``handle_file_creation``, ``handle_file_close``, ``handle_file_deletion`` with the
    filename when appropriate.

    """
    path = patched_test_manager_instance.files_path if called else patched_test_manager_instance.watch_path

    file_path = os.path.join(path, "test.fq")

    touch(file_path)

    await asyncio.sleep(1)

    if called:
        patched_test_manager_instance.handle_create.assert_called_with("test.fq")
        patched_test_manager_instance.handle_close.assert_called_with("test.fq")
    else:
        assert patched_test_manager_instance.handle_create.called is False
        assert patched_test_manager_instance.handle_close.called is False

    os.remove(file_path)

    await asyncio.sleep(0.1)

    if called:
        patched_test_manager_instance.handle_delete.assert_called_with("test.fq")
    else:
        assert patched_test_manager_instance.handle_delete.called is False


@pytest.mark.parametrize("has_ext", [True, False])
async def test_handle_watch(has_ext, mocker, dbi, test_manager_instance):

    m_copy = mocker.patch("shutil.copy")

    m_create = mocker.patch("virtool.files.db.create", make_mocked_coro({"id": "foobar-test.fq"}))

    m_has_read_extension = mocker.patch("virtool.files.utils.has_read_extension", return_value=has_ext)

    m_remove = mocker.patch("os.remove")

    filename = "test.fq"

    path = os.path.join(test_manager_instance.watch_path, filename)

    await test_manager_instance.handle_watch(filename)

    m_has_read_extension.assert_called_with(filename)

    if has_ext:
        m_create.assert_called_with(
            dbi,
            filename,
            "reads"
        )

        m_copy.assert_called_with(
            path,
            os.path.join(test_manager_instance.files_path, "foobar-test.fq")
        )

    m_remove.assert_called_with(path)


@pytest.mark.parametrize("tracked", [True, False])
async def test_handle_create(tracked, dbi, test_manager_instance):
    filename = "foobar-test.fq"

    if tracked:
        await dbi.files.insert_one({
            "_id": filename
        })

    await test_manager_instance.handle_create(filename)

    document = await dbi.files.find_one()

    if tracked:
        assert document == {
            "_id": filename,
            "created": True
        }
    else:
        assert document is None
        assert await dbi.files.count() == 0


@pytest.mark.parametrize("tracked", [True, False])
async def test_handle_close(tracked, mocker, dbi, test_manager_instance):
    """
    When a file is

    """
    m_file_status = mocker.patch("virtool.utils.file_stats", return_value={"modify": "foobar", "size": 245})

    m_remove = mocker.patch("os.remove")

    filename = "foobar-test.fq"

    if tracked:
        await dbi.files.insert_one({
            "_id": filename
        })

    await test_manager_instance.handle_close(filename)

    document = await dbi.files.find_one()

    path = os.path.join(test_manager_instance.files_path, filename)

    if tracked:
        assert document == {
            "_id": filename,
            "ready": True,
            "size": 245
        }

        m_file_status.assert_called_with(path)

    else:
        assert document is None
        m_remove.assert_called_with(path)


async def test_handle_delete(dbi, test_manager_instance):
    """
    Test the the correspond database document for a file is deleted when the file is deleted.

    """
    filename = "foobar-test.fq"

    await dbi.files.insert_one({
        "_id": filename
    })

    await test_manager_instance.handle_delete(filename)

    assert not await dbi.files.count()
