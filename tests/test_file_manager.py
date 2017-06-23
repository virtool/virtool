import os
import time
import asyncio
import virtool.file_manager


class TestFileManager:

    async def test_create(self, mocker, loop, test_motor, tmpdir):
        m = mocker.stub(name="dispatch")

        async def dispatch(*args, **kwargs):
            m(*args, **kwargs)

        manager = virtool.file_manager.Manager(loop, test_motor, dispatch, str(tmpdir))

        path = os.path.join(str(tmpdir), "test.dat")

        await test_motor.files.insert_one({
            "_id": "test.dat"
        })

        with open(path, "w") as handle:
            handle.write("hello world")

        await asyncio.sleep(0.5, loop=loop)

        documents = await test_motor.files.find().to_list(None)

        await manager.close()

        assert documents == [{"eof": True, "size_now": 11, "_id": "test.dat", "created": True}]

    async def test_delete(self, mocker, loop, test_motor, tmpdir):
        m = mocker.stub(name="dispatch")

        async def dispatch(*args, **kwargs):
            m(*args, **kwargs)

        manager = virtool.file_manager.Manager(loop, test_motor, dispatch, str(tmpdir))

        path = os.path.join(str(tmpdir), "test.dat")

        await test_motor.files.insert_one({
            "_id": "test.dat"
        })

        with open(path, "w") as handle:
            handle.write("hello world")

        os.remove(path)

        await asyncio.sleep(0.5, loop=loop)

        print(await test_motor.files.find().to_list(None))

        await manager.close()

        assert 0
