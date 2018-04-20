import os

import virtool.errors
import virtool.virus_index


class TestRemoveUnusedIndexFiles:

    def test(self, tmpdir, test_motor):
        for path in ["anb763hj", "hd7hd902", "ab2c9081"]:
            tmpdir.mkdir(path).join("test.fa")

        base_path = str(tmpdir)

        virtool.virus_index.remove_unused_index_files(base_path, ["anb763hj"])

        assert set(os.listdir(base_path)) == {"anb763hj"}


class TestGetCurrentIndexVersion:

    async def test(self, test_motor):
        await test_motor.indexes.insert_many([
            {"_id": "anb763hj", "version": 2, "ready": False},
            {"_id": "hd7hd902", "version": 1, "ready": True},
            {"_id": "xnm00sla", "version": 0, "ready": True}
        ])

        assert await virtool.virus_index.get_current_index_version(test_motor) == 1

    async def test_dne(self, test_motor):
        assert await virtool.virus_index.get_current_index_version(test_motor) == -1


class TestGetCurrentIndex:

    async def test(self, test_motor):
        await test_motor.indexes.insert_many([
            {"_id": "anb763hj", "version": 2, "ready": False},
            {"_id": "hd7hd902", "version": 1, "ready": True},
            {"_id": "xnm00sla", "version": 0, "ready": True}
        ])

        assert await virtool.virus_index.get_current_index(test_motor) == ("hd7hd902", 1)
