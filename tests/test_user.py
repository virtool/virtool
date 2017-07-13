import pytest
import hashlib

import virtool.user
import virtool.utils


class TestUserExists:

    async def test(self, test_motor):
        await test_motor.users.insert_one({
            "_id": "test"
        })

        assert await virtool.user.user_exists(test_motor, "test")

    async def test_dne(self, test_motor):
        await test_motor.users.insert_one({
            "_id": "test"
        })

        assert await virtool.user.user_exists(test_motor, "test")


class TestValidateCredentials:

    @pytest.mark.parametrize("user_id,password,result", [
        ("test", "foobar", True),
        ("baz", "foobar", False),
        ("test", "baz", False),
        ("baz", "baz", False)
    ])
    @pytest.mark.parametrize("legacy", [True, False])
    async def test(self, legacy, user_id, password, result, test_motor):
        """
        Test that valid, bcrypt-based credentials work.

        """
        document = {
            "_id": "test"
        }

        if legacy:
            salt = virtool.utils.random_alphanumeric(24)

            document.update({
                "salt": salt,
                "password": hashlib.sha512(salt.encode("utf-8") + "foobar".encode("utf-8")).hexdigest()
            })
        else:
            document["password"] = virtool.user.hash_password("foobar")

        await test_motor.users.insert_one(document)

        assert await virtool.user.validate_credentials(test_motor, user_id, password) is result


class TestHashAndCheckPassword:

    def test(self):
        assert virtool.user.check_password("hello_world", virtool.user.hash_password("hello_world"))


class TestHashCheckLegacyPassword:

    def test(self):
        salt = virtool.utils.random_alphanumeric(24)

        hashed = hashlib.sha512(salt.encode("utf-8") + "hello_world".encode("utf-8")).hexdigest()

        assert virtool.user.check_legacy_password("hello_world", salt, hashed)





