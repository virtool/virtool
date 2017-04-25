import hashlib

from virtool.utils import random_alphanumeric
from virtool.user import hash_password, check_password, check_legacy_password


class TestHashPassword:

    def test_basic(self):
        assert check_password("hello_world", hash_password("hello_world"))


class TestLegacyHashPassword:

    def test_basic(self):
        salt = random_alphanumeric(24)

        hashed = hashlib.sha512(salt.encode("utf-8") + "hello_world".encode("utf-8")).hexdigest()

        assert check_legacy_password("hello_world", salt, hashed)
