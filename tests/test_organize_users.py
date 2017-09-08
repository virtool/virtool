import virtool.organize


class TestUnsetSessions:

    async def test(self, test_motor, create_user):
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
            "permissions": {
                "add_host": False,
                "add_sample": False,
                "add_virus": False,
                "archive_job": False,
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
