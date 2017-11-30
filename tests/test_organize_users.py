import virtool.organize
from virtool.user_permissions import PERMISSIONS


async def test(test_motor, create_user):
    await test_motor.users.insert_one({
        "_id": "foobar",
        "groups": [
            "administrator"
        ],
        "sessions": [
            "session"
        ]
    })

    await virtool.organize.organize_users(test_motor)

    assert await test_motor.users.find().to_list(None) == [{
        "_id": "foobar",
        "identicon": "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2",
        "api_keys": [],
        "permissions": {p: False for p in PERMISSIONS},
        "primary_group": "",
        "groups": [
            "administrator"
        ]
    }]
