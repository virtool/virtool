import virtool.organize_utils


class TestUpdateUserField:

    async def test(self, test_motor):
        await test_motor.test.insert_many([
            {
                "_id": "test",
                "user_id": "foobar"
            },
            {
                "_id": "test1",
                "username": "baz"
            },
            {
                "_id": "test2",
                "user": {
                    "id": "foo"
                }
            }
        ])

        await virtool.organize_utils.update_user_field(test_motor.test)

        assert await test_motor.test.find().to_list(None) == [
            {"_id": "test2", "user": {"id": "foo"}},
            {"_id": "test", "user": {"id": "foobar"}},
            {"_id": "test1", "user": {"id": "baz"}}
        ]


