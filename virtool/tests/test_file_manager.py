import os
import pytest
import datetime

from virtool.files import Manager


class TestInit:

    def test_paths(self, called_tester):

        add_periodic_callback = called_tester()

        manager = Manager(None, "test_data", add_periodic_callback)

        assert manager.paths["upload"] == "test_data/upload" and manager.paths["download"] == "test_data/download"

    def test_periodic(self, called_tester):

        add_periodic_callback = called_tester()

        Manager(None, "test_data", add_periodic_callback)

        assert add_periodic_callback.with_args[0].__name__ == "iterate"
        assert add_periodic_callback.with_args[1] == 20000


class TestRegister:

    @pytest.mark.gen_test
    def test_db(self, session_mongo, temp_mongo, static_time, called_tester, data_dir):

        add_periodic_callback = called_tester()

        manager = Manager(temp_mongo, str(data_dir), add_periodic_callback)

        _id = yield manager.register(
            "registered_test_file",
            bytes("hello_world", "utf-8"),
            static_time,
            content_type="text",
            download=False
        )

        document = session_mongo.files.find_one()

        assert document == {
            "_id": _id,
            "name": "registered_test_file",
            "download": False,
            "content_type": "text",
            "expires": static_time + datetime.timedelta(minutes=20)
        }

        download_path = os.path.join(str(data_dir), "upload")

        assert _id in os.listdir(download_path)

        file_path = os.path.join(download_path, _id)

        with open(file_path, "rb") as handle:
            content = handle.read().decode()
            assert content == "hello_world"

    @pytest.mark.gen_test
    def test_download(self, session_mongo, temp_mongo, static_time, called_tester, data_dir):
        add_periodic_callback = called_tester()

        manager = Manager(temp_mongo, str(data_dir), add_periodic_callback)

        _id = yield manager.register(
            "registered_test_file",
            bytes("hello_world", "utf-8"),
            static_time,
            content_type="text",
            download=False
        )

        document = session_mongo.files.find_one()

        assert document == {
            "_id": _id,
            "name": "registered_test_file",
            "download": False,
            "content_type": "text",
            "expires": static_time + datetime.timedelta(minutes=20)
        }

        download_path = os.path.join(str(data_dir), "upload")

        assert _id in os.listdir(download_path)

        file_path = os.path.join(download_path, _id)

        with open(file_path, "rb") as handle:
            content = handle.read().decode()
            assert content == "hello_world"

'''
class TestRemove:

    @pytest.mark.gen_test
    def test_existent(self, db, periodic, data_dir, static_time):

        add_periodic_callback, _ = periodic

        download_path = os.path.join(str(data_dir), "download")

        file_path = os.path.join(download_path, "existent_file")

        with open(file_path, "w") as handle:
            handle.write("hello world")

        assert "existent_file" in os.listdir(download_path)

        manager = Manager(db, str(data_dir), add_periodic_callback)

        _id = yield manager.register(
            "test_file",
            bytes("hello_world", "utf-8"),
            static_time,
            content_type="text",
            download=True
        )

        assert _id in os.listdir(download_path)

        result = yield manager.remove({"_id": _id, "download": True})

        yield result

        assert "existent_file" not in os.listdir(download_path)
'''