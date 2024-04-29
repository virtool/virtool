import pytest

from virtool.account.mongo import compose_password_update, get_alternate_id


def test_compose_password_update(mocker, static_time):
    """Test that compose password returns the expected update `dict`. Ensure the password is hashed
    using :func:`hash_password`.

    """
    m_hash_password = mocker.patch(
        "virtool.users.utils.hash_password",
        return_value="foobar",
    )

    update = compose_password_update("baz")

    assert update == {
        "force_reset": False,
        "invalidate_sessions": False,
        "last_password_change": static_time.datetime,
        "password": "foobar",
    }

    m_hash_password.assert_called_with("baz")


@pytest.mark.parametrize(
    "existing,expected",
    [
        ([], "foo_0"),
        (["bar_0"], "foo_0"),
        (["foo_0"], "foo_1"),
        (["foo_0", "foo_1"], "foo_2"),
    ],
    ids=["no keys", "no matching key ids", "suffix 1", "suffix 2"],
)
async def test_get_alternate_id(existing, expected, mongo):
    for key_id in existing:
        await mongo.keys.insert_one({"id": key_id})

    assert await get_alternate_id(mongo, "foo") == expected
