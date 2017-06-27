import os
import multiprocessing
import virtool.file_manager


class TestWatch:

    async def test_alive(self, tmpdir):
        queue = multiprocessing.Queue()

        watcher = virtool.file_manager.Watcher(str(tmpdir), queue)
        watcher.start()

        assert queue.get(block=True, timeout=2) == "alive"

        watcher.terminate()

    async def test_create(self, tmpdir):
        queue = multiprocessing.Queue()

        watcher = virtool.file_manager.Watcher(str(tmpdir), queue)
        watcher.start()

        # This will be an 'alive' message
        queue.get(block=True, timeout=2)

        path = os.path.join(str(tmpdir), "test.dat")

        with open(path, "w") as handle:
            handle.write("hello world")

        first_message = queue.get(block=True, timeout=2)

        assert first_message["action"] == "create"

        file = dict(first_message["file"])
        file.pop("modify")

        assert file == {
            "filename": "test.dat",
            "size": 11
        }

        action = "modify"
        next_message = None

        while action == "modify":
            next_message = queue.get(block=True, timeout=2)
            action = next_message["action"]

        assert next_message["action"] == "close"

        file = dict(first_message["file"])
        file.pop("modify")

        assert file == {
            "filename": "test.dat",
            "size": 11
        }

        watcher.terminate()

    async def test_delete(self, tmpdir):
        path = os.path.join(str(tmpdir), "test.dat")

        with open(path, "w") as handle:
            handle.write("hello world")

        queue = multiprocessing.Queue()

        watcher = virtool.file_manager.Watcher(str(tmpdir), queue)
        watcher.start()

        # This will be an 'alive' message
        queue.get(block=True, timeout=2)

        os.remove(path)

        message = queue.get(block=True, timeout=2)

        assert message == {
            "action": "delete",
            "file": {
                "filename": "test.dat"
            }
        }

        watcher.terminate()


class TestFileManager:

    async def test_create(self, mocker, tmpdir, loop, test_db, test_motor, test_queue):
        """
        Test that a ``create`` action results in the ``created`` field on the matching file document in the database
        to be set to ``True``.

        """

        m = mocker.stub(name="dispatch")

        async def dispatch(*args, **kwargs):
            m(*args, **kwargs)

        test_db.files.insert_one({
            "_id": "test.dat"
        })

        test_queue.put("alive")

        test_queue.put({
            "action": "create",
            "file": {
                "filename": "test.dat",
                "size": 50
            }
        })

        manager = virtool.file_manager.Manager(loop, test_motor, dispatch, str(tmpdir), clean_interval=None)

        await manager.start()
        await manager.close()

        assert test_db.files.find_one() == {
            "_id": "test.dat",
            "created": True
        }

    async def test_modify(self, mocker, tmpdir, loop, test_db, test_motor, test_queue):
        """
        Test that a ``modify`` action results in the ``size`` field being updated on the matching file document in the
        database.

        """

        m = mocker.stub(name="dispatch")

        async def dispatch(*args, **kwargs):
            m(*args, **kwargs)

        test_db.files.insert_one({
            "_id": "test.dat",
            "created": True
        })

        test_queue.put("alive")

        test_queue.put({
            "action": "modify",
            "file": {
                "filename": "test.dat",
                "size": 50
            }
        })

        manager = virtool.file_manager.Manager(loop, test_motor, dispatch, str(tmpdir), clean_interval=None)

        await manager.start()
        await manager.close()

        assert test_db.files.find_one() == {
            "_id": "test.dat",
            "created": True,
            "size_now": 50
        }

    async def test_close(self, mocker, tmpdir, loop, test_db, test_motor, test_queue):
        """
        Test that a ``close`` action results in ``eof`` being set to ``True`` on the matching file document in the
        database.

        """
        m = mocker.stub(name="dispatch")

        async def dispatch(*args, **kwargs):
            m(*args, **kwargs)

        test_db.files.insert_one({
            "_id": "test.dat",
            "created": True
        })

        test_queue.put("alive")

        test_queue.put({
            "action": "close",
            "file": {
                "filename": "test.dat",
                "size": 100
            }
        })

        manager = virtool.file_manager.Manager(loop, test_motor, dispatch, str(tmpdir), clean_interval=None)

        await manager.start()
        await manager.close()

        assert test_db.files.find_one() == {
            "_id": "test.dat",
            "created": True,
            "eof": True,
            "size_now": 100
        }

    async def test_delete(self, mocker, tmpdir, loop, test_db, test_motor, test_queue):
        """
        Test that a ``delete`` action from the Watcher results in the deletion of the matching file document in the
        database.

        """
        m = mocker.stub(name="dispatch")

        async def dispatch(*args, **kwargs):
            m(*args, **kwargs)

        test_db.files.insert_one({
            "_id": "test.dat",
            "created": True,
            "eof": True,
            "size_now": 100
        })

        test_queue.put("alive")

        test_queue.put({
            "action": "delete",
            "file": {
                "filename": "test.dat"
            }
        })

        manager = virtool.file_manager.Manager(loop, test_motor, dispatch, str(tmpdir), clean_interval=None)

        await manager.start()
        await manager.close()

        assert test_db.files.count() == 0

    async def test_start_and_close(self, mocker, tmpdir, loop, test_motor):
        """
        Test the starting and closing the file manager work as designed. The manager should wait for the watch to
        send and "alive" message on the Queue before returning. This results in the ``alive`` attribute being set to
        ``True`` on the manager.

        Closing the manager should result in ``alive`` being set to ``False``.

        """
        m = mocker.stub(name="dispatch")

        async def dispatch(*args, **kwargs):
            m(*args, **kwargs)

        manager = virtool.file_manager.Manager(loop, test_motor, dispatch, str(tmpdir), clean_interval=None)

        assert manager.alive is False

        await manager.start()

        assert manager.alive is True

        await manager.close()

        assert manager.alive is False

    async def test_clean_dir(self, mocker, tmpdir, loop, test_db, test_motor):
        m = mocker.stub(name="dispatch")

        async def dispatch(*args, **kwargs):
            m(*args, **kwargs)

        test_db.files.insert_one({
            "_id": "test.dat"
        })

        file_a = tmpdir.join("test.dat")
        file_a.write("hello world")

        file_b = tmpdir.join("invalid.dat")
        file_b.write("foo bar")

        manager = virtool.file_manager.Manager(loop, test_motor, dispatch, str(tmpdir))

        await manager.start()

        await manager.close()

        assert os.listdir(str(tmpdir)) == ["test.dat"]

    async def test_clean_db(self, mocker, tmpdir, loop, test_db, test_motor):
        m = mocker.stub(name="dispatch")

        async def dispatch(*args, **kwargs):
            m(*args, **kwargs)

        test_db.files.insert_many([
            {"_id": "test.dat", "created": True},
            {"_id": "invalid.dat", "created": True}
        ])

        file_a = tmpdir.join("test.dat")
        file_a.write("hello world")

        manager = virtool.file_manager.Manager(loop, test_motor, dispatch, str(tmpdir))

        await manager.start()

        await manager.close()

        assert list(test_db.files.find()) == [{"_id": "test.dat", "created": True}]
