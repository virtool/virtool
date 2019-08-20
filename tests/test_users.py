import pytest

import virtool.db.users
import virtool.users
import virtool.utils


@pytest.mark.parametrize("user_id,identicon", [
    ("bob", "81b637d8fcd2c6da6359e6963113a1170de795e4b725b84d1e0b4cfd9ec58ce9"),
    ("martha", "7dbef27a673fea6454664f4fbe9685f3bc3cf1813eea89267bc99641e4d59517")
], ids=["bob", "martha"])
def test_calculate_identicon(user_id, identicon):
    """
    Test that identicon strings are calculated as expected for two different user names.

    """
    assert virtool.users.calculate_identicon(user_id) == identicon


@pytest.mark.parametrize("key,hashed,result", [
    ("foobar", "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2", True),
    ("foobar", "be9b4c9674ae3932cf382b362458d6107e9433d1d9e05bef3eef187bb7785c05", False)
], ids=["success", "failure"])
def test_check_api_key(key, hashed, result):
    """
    Test that API keys are validated against hashed ones correctly in success and failure cases.

    """
    assert virtool.users.check_api_key(key, hashed) is result


@pytest.mark.parametrize("password,salt,result", [
    (
        "hello_world",
        "6rn1x86nnlqfj5bqg1n5qhcd",
        True
    ),
    (
        "bye_world",
        "6rn1x86nnlqfj5bqg1n5qhcd",
        False
    ),
    (
        "hello_world",
        "abc1x86nnlqfj5bqg1n5q123",
        False
    )
], ids=["success", "failure_password", "failure_salt"])
def test_check_legacy_password(password, salt, result):
    assert virtool.users.check_legacy_password(
        password,
        salt,
        "33a733347cdb47634252e5964b26c116494ad7fe1c0bde2f8120fe73d0d01a2993251b4a5b07050c996c01ace6ec26cb155a1e0d7e712e5ca9a5c4aaa16b5ac5"
    ) is result


@pytest.mark.parametrize("password,hashed,result", [
    ("foobar", b"$2b$12$rCRx7p4HlrNXxIcqwWXmLe5CR2MUCPh00bOLnNsAeCxzUJzR6MkLu", True),
    ("foobar", b"$2b$12$4Hj5m9ytlq.yUCNNXmZyGepaMWVnZM/SP6zWGsKpN.HYCP7J99pZe", False)
], ids=["success", "failure"])
def test_check_password(password, hashed, result):
    """
    Test that passwords are validated against bcrypt hashed ones correctly in success and failure cases.

    """
    assert virtool.users.check_password(password, hashed) is result


def test_generate_base_permissions():
    assert virtool.users.generate_base_permissions() == {p: False for p in virtool.users.PERMISSIONS}
