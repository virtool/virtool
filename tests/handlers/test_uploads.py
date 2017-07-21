import os
import sys
import pytest


class TestUpload:

    @pytest.mark.parametrize("path,file_type", [
        ("/upload/viruses", "viruses"),
        ("/upload/reads", "reads"),
        ("/upload/hmm/profiles", "profiles"),
        ("/upload/hmm/annotations", "annotations"),
        ("/upload/host", "host")
    ])
    async def test(self, path, file_type, tmpdir, spawn_client, test_dispatch, static_time, test_random_alphanumeric):
        client = await spawn_client()

        client.app["settings"] = {
            "data_path": str(tmpdir)
        }

        # This is where the file should end up.
        files_dir = tmpdir.mkdir("files")

        # This is the path to the file to be uploaded.
        path = os.path.join(sys.path[0], "tests", "test_files", "files", "test.fq.gz")

        files = {
            "file": open(path, "rb")
        }

        resp = await client.post_form("/upload/reads?name=Test.fq.gz", data=files)

        assert resp.status == 200

        assert os.listdir(str(files_dir)) == ["{}-Test.fq.gz".format(test_random_alphanumeric.last_choice)]

        assert await resp.json() == {
            "name": "Test.fq.gz",
            "type": "reads",
            "uploaded_at": "2017-10-06T20:00:00Z",
            "id": "{}-Test.fq.gz".format(test_random_alphanumeric.last_choice),
            "user": {
                "id": None
            }
        }

        assert test_dispatch.stub.call_args[0] == (
            "files",
            "update",
            {
                "name": "Test.fq.gz",
                "type": "reads",
                "uploaded_at": static_time,
                "id": "{}-Test.fq.gz".format(test_random_alphanumeric.last_choice),
                "user": {
                    "id": None
                }
            }
        )

    async def test_invalid_query(self, spawn_client, resp_is):
        client = await spawn_client()

        path = os.path.join(sys.path[0], "tests", "test_files", "files", "test.fq.gz")

        files = {
            "file": open(path, "rb")
        }

        resp = await client.post_form("/upload/reads", data=files)

        assert await resp_is.invalid_query(resp, {
            "name": ["required field"]
        })

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client()

        path = os.path.join(sys.path[0], "tests", "test_files", "files", "test.fq.gz")

        files = {
            "file": open(path, "rb")
        }

        resp = await client.post_form("/uploads/foobar", data=files)

        assert resp.status == 404
