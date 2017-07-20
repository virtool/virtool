import os
import shutil
import pytest

import virtool.errors
import virtool.subtraction


class TestSetStats:

    async def test(self, test_motor):
        await test_motor.subtraction.insert_one({
            "_id": "test"
        })

        stats = {
            "count": 5,
            "foo": "bar",
            "nucleotides": {
                "a": 0.25,
                "t": 0.25,
                "g": 0.25,
                "c": 0.25
            }
        }

        await virtool.subtraction.set_stats(test_motor, "test", stats)

        assert await test_motor.subtraction.find_one() == {
            "_id": "test",
            "count": stats["count"],
            "nucleotides": stats["nucleotides"]
        }

    async def test_dne(self, test_motor):
        with pytest.raises(virtool.errors.DatabaseError) as err:
            await virtool.subtraction.set_stats(test_motor, "test", {"count": None, "nucleotides": None})

        assert "No subtraction with id 'test'" in str(err)


class TestSetReady:

    async def test(self, test_motor):
        await test_motor.subtraction.insert_one({
            "_id": "test",
            "ready": False
        })

        await virtool.subtraction.set_ready(test_motor, "test")

        assert await test_motor.subtraction.find_one() == {
            "_id": "test",
            "ready": True
        }

    async def test_dne(self, test_motor):
        with pytest.raises(virtool.errors.DatabaseError) as err:
            await virtool.subtraction.set_ready(test_motor, "test")

        assert "No subtraction with id 'test'" in str(err)


class TestBowtie2IndexNames:

    def test(self, tmpdir, test_files_path):
        index_dir_path = os.path.join(str(tmpdir), "index")

        shutil.copytree(os.path.join(test_files_path, "index"), index_dir_path)

        result = virtool.subtraction.get_bowtie2_index_names(os.path.join(index_dir_path, "test"))

        assert result == [
            "test_1",
            "test_2",
            "test_3",
            "test_4"
        ]

    def test_file_not_found(self, tmpdir, test_files_path):
        index_dir_path = os.path.join(str(tmpdir), "index")

        shutil.copytree(os.path.join(test_files_path, "index"), index_dir_path)

        index_path = os.path.join(index_dir_path, "foobar")

        with pytest.raises(FileNotFoundError) as err:
            virtool.subtraction.get_bowtie2_index_names(index_path)

        assert "Index not found at {}".format(index_path) in str(err)
