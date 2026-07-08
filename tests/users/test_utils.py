import pytest

import virtool.users.utils
from virtool.users.utils import Permission


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
    """Test that passwords are validated against bcrypt hashed ones correctly in success and failure
    cases.

    """
    assert virtool.users.utils.check_password(password, hashed) is result


def test_generate_base_permissions():
    assert virtool.users.utils.generate_base_permissions() == {
        p.value: False for p in Permission
    }
