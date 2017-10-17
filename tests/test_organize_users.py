import virtool.organize


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
        "permissions": {
            "modify_host": False,
            "create_sample": False,
            "cancel_job": False,
            "manage_users": False,
            "modify_hmm": False,
            "modify_options": False,
            "modify_virus": False,
            "rebuild_index": False,
            "remove_host": False,
            "remove_job": False,
            "remove_virus": False
        },
        "primary_group": "",
        "groups": [
            "administrator"
        ]
    }]
