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
