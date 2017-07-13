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

    def test(self):
        pass


class TestHashPassword:

    def test_basic(self):
        assert virtool.user.check_password("hello_world", virtool.user.hash_password("hello_world"))


class TestLegacyHashPassword:

    def test_basic(self):
        salt = virtool.utils.random_alphanumeric(24)

        hashed = hashlib.sha512(salt.encode("utf-8") + "hello_world".encode("utf-8")).hexdigest()

        assert virtool.user.check_legacy_password("hello_world", salt, hashed)


