import pytest

import virtool.users.db
import virtool.users.utils
import virtool.utils


@pytest.mark.parametrize(
    "password,salt,result",
    [
        ("hello_world", "6rn1x86nnlqfj5bqg1n5qhcd", True),
        ("bye_world", "6rn1x86nnlqfj5bqg1n5qhcd", False),
        ("hello_world", "abc1x86nnlqfj5bqg1n5q123", False),
    ],
    ids=["success", "failure_password", "failure_salt"],
)
def test_check_legacy_password(password, salt, result):
    assert (
        virtool.users.utils.check_legacy_password(
            password,
            salt,
            "33a733347cdb47634252e5964b26c116494ad7fe1c0bde2f8120fe73d0d01a2993251b4a5b07050c996c01ace6ec26cb155a1e0d7e712e5ca9a5c4aaa16b5ac5",
        )
        is result
    )


@pytest.mark.parametrize(
    "password,hashed,result",
    [
        (
            "foobar",
            b"$2b$12$rCRx7p4HlrNXxIcqwWXmLe5CR2MUCPh00bOLnNsAeCxzUJzR6MkLu",
            True,
        ),
        (
            "foobar",
            b"$2b$12$4Hj5m9ytlq.yUCNNXmZyGepaMWVnZM/SP6zWGsKpN.HYCP7J99pZe",
            False,
        ),
    ],
    ids=["success", "failure"],
)
def test_check_password(password, hashed, result):
    """
    Test that passwords are validated against bcrypt hashed ones correctly in success and failure
    cases.

    """
    assert virtool.users.utils.check_password(password, hashed) is result


def test_generate_base_permissions():
    assert virtool.users.utils.generate_base_permissions() == {
        p: False for p in virtool.users.utils.PERMISSIONS
    }
