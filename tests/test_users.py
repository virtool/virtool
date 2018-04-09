import hashlib

import virtool.db.users
import virtool.users
import virtool.utils


def test_hash_and_check_password():
    assert virtool.users.check_password("hello_world", virtool.users.hash_password("hello_world"))


def test_hash_and_check_legacy_password():
    salt = virtool.utils.random_alphanumeric(24)
    hashed = hashlib.sha512(salt.encode("utf-8") + "hello_world".encode("utf-8")).hexdigest()

    assert virtool.users.check_legacy_password("hello_world", salt, hashed)
