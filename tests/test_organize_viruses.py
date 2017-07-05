import pytest

import virtool.organize


class TestUnset:

    @pytest.mark.parametrize("field", ["segments", "abbrevation", "new"])
    async def test(self, field, test_motor):
        await test_motor.viruses.insert_one({
            "_id": 1,
            field: True
        })

        await virtool.organize.organize_viruses(test_motor)

        assert await test_motor.viruses.find().to_list(None) == [{
            "_id": 1
        }]
