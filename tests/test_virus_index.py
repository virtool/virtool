import os
import pytest

import virtool.errors
import virtool.virus_index


class TestSetStats:

    async def test(self, test_motor):
        await test_motor.indexes.insert_one({
            "_id": "foobar"
        })

        await virtool.virus_index.set_stats(test_motor, "foobar", {
            "modification_count": 23,
            "modified_virus_count": 17,
            "virus_count": 231
        })

        assert await test_motor.indexes.find_one() == {
            "_id": "foobar",
            "modification_count": 23,
            "modified_virus_count": 17,
            "virus_count": 231
        }

    async def test_validation(self, test_motor):
        with pytest.raises(ValueError) as err:
            await virtool.virus_index.set_stats(test_motor, "foobar", {
                "modified_virus_number": 17,
                "virus_count": 231
            })

        assert "could not be validated" in str(err)

    async def test_dne(self, test_motor):
        with pytest.raises(virtool.errors.DatabaseError) as err:
            await virtool.virus_index.set_stats(test_motor, "foobar", {
                "modification_count": 23,
                "modified_virus_count": 17,
                "virus_count": 231
            })

        assert "Could not find index 'foobar'" in str(err)


class TestSetReady:

    async def test(self, test_motor):
        await test_motor.indexes.insert_one({
            "_id": "foobar",
            "ready": False
        })

        await virtool.virus_index.set_ready(test_motor, "foobar")

        assert await test_motor.indexes.find_one() == {
            "_id": "foobar",
            "ready": True
        }

    async def test_dne(self, test_motor):
        with pytest.raises(virtool.errors.DatabaseError) as err:
            await virtool.virus_index.set_ready(test_motor, "foobar")

        assert "Could not find index 'foobar'" in str(err)


class TestCleanupIndexFiles:

    async def test(self, tmpdir, test_motor):
        settings = {
            "data_path": str(tmpdir)
        }

        ref_dir = tmpdir.mkdir("reference").mkdir("viruses")

        for index_id in ["anb763hj", "hd7hd902", "ab2c9081", "89mn4z01", "xnm00sla"]:
            index_dir = ref_dir.mkdir(index_id)
            index_dir.join("test.bt2")

        await test_motor.analyses.insert_many([
            {"_id": "foo", "ready": True, "index": {"id": "89mn4z01", "version": 1}},
            {"_id": "bar", "ready": False, "index": {"id": "ab2c9081", "version": 2}}
        ])

        await test_motor.indexes.insert_many([
            {"_id": "anb763hj", "version": 4, "ready": False},
            {"_id": "hd7hd902", "version": 3, "ready": True},
            {"_id": "ab2c9081", "version": 2, "ready": True},
            {"_id": "89mn4z01", "version": 1, "ready": True},
            {"_id": "xnm00sla", "version": 0, "ready": True}
        ])

        await virtool.virus_index.cleanup_index_files(test_motor, settings)

        assert set(os.listdir(str(ref_dir))) == {"anb763hj", "hd7hd902", "ab2c9081"}


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
