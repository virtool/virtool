import os
import pytest
import sys


class TestUpload:

    @pytest.mark.parametrize("file_type", ["reference", "reads", "hmm", "subtraction"])
    async def test(self, file_type, tmpdir, spawn_client, static_time, test_random_alphanumeric):
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        client.app["settings"]["data_path"] = str(tmpdir)

        # This is where the file should end up.
        files_dir = tmpdir.mkdir("files")

        # This is the path to the file to be uploaded.
        path = os.path.join(sys.path[0], "tests", "test_files", "test.fq.gz")

        files = {
            "file": open(path, "rb")
        }

        resp = await client.post_form("/upload/{}?name=Test.fq.gz".format(file_type), data=files)

        assert resp.status == 201

        assert os.listdir(str(files_dir)) == ["{}-Test.fq.gz".format(test_random_alphanumeric.last_choice)]

        assert await resp.json() == {
            "name": "Test.fq.gz",
            "type": file_type,
            "ready": False,
            "reserved": False,
            "uploaded_at": static_time.iso,
            "id": "{}-Test.fq.gz".format(test_random_alphanumeric.last_choice),
            "user": {
                "id": "test"
            }
        }

    async def test_invalid_query(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        path = os.path.join(sys.path[0], "tests", "test_files", "test.fq.gz")

        files = {
            "file": open(path, "rb")
        }

        resp = await client.post_form("/upload/reads", data=files)

        assert await resp_is.invalid_query(resp, {
            "name": ["required field"]
        })

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["upload_file"])

        path = os.path.join(sys.path[0], "tests", "test_files", "test.fq.gz")

        files = {
            "file": open(path, "rb")
        }

        resp = await client.post_form("/uploads/foobar", data=files)

        assert resp.status == 404
