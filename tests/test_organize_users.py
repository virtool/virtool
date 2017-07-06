import pytest

import virtool.organize


class TestUnsetSessions:

    async def test(self, test_motor, create_user):
        await test_motor.users.insert_one({
            "_id": "foobar",
            "sessions": [
                "session"
            ]
        })

        await virtool.organize.organize_users(test_motor)

        assert test_motor.users.find().to_list(None) == [{
            "_id": "foobar"
        }]
