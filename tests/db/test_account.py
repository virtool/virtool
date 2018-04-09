import virtool.db.account


async def test_update_settings(test_motor, bob):
    """
    Test that account settings can be updated.

    """
    await test_motor.users.insert_one(bob)

    bob["settings"] = dict(bob["settings"], show_ids=False)

    assert bob["settings"] == await virtool.db.account.update_settings(test_motor, "bob", {
        "show_ids": False
    })

    assert await test_motor.users.find_one("bob") == bob
