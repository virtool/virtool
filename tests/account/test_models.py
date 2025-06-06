import pytest
from pydantic import ValidationError

from virtool.account.models import Account, check_email

BASE_ACCOUNT_DATA = {
    "id": "test_user",
    "handle": "testuser",
    "active": True,
    "administrator_role": None,
    "force_reset": False,
    "groups": [],
    "last_password_change": "2023-01-01T00:00:00Z",
    "permissions": {
        "cancel_job": False,
        "create_ref": False,
        "create_sample": False,
        "modify_hmm": False,
        "modify_subtraction": False,
        "remove_file": False,
        "remove_job": False,
        "upload_file": False,
    },
    "primary_group": None,
    "settings": {
        "quick_analyze_workflow": "pathoscope_bowtie",
        "show_ids": True,
        "show_versions": True,
        "skip_quick_analyze_dialog": True,
    },
}


def create_account_data(email=None):
    """Create account data with specified email value."""
    return {**BASE_ACCOUNT_DATA, "email": email}


class TestCheckEmail:
    """Test the email validation function."""

    def test_ok(self):
        """Test that valid email addresses pass validation."""
        valid_emails = [
            "test@gmail.com",
            "user.name@yahoo.com",
            "user+tag@outlook.com",
        ]

        for email in valid_emails:
            assert check_email(email) == email

    def test_invalid(self):
        """Test that invalid email addresses raise ValueError."""
        invalid_emails = [
            "invalid-email",
            "@example.com",
            "test@",
            "test..test@example.com",
            "test@.com",
        ]

        for email in invalid_emails:
            with pytest.raises(ValueError, match="The format of the email is invalid"):
                check_email(email)

    def test_none(self):
        """Test that None values are handled correctly."""
        assert check_email(None) is None

    def test_empty_string(self):
        """Test that empty strings raise ValueError."""
        with pytest.raises(ValueError, match="The format of the email is invalid"):
            check_email("")

    def test_whitespace_only(self):
        """Test that whitespace-only strings raise ValueError."""
        with pytest.raises(ValueError, match="The format of the email is invalid"):
            check_email("   ")


class TestAccountModel:
    """Test the Account model email validation."""

    def test_account_with_valid_email(self):
        """Test creating Account with valid email."""
        account = Account(**create_account_data("test@gmail.com"))
        assert account.email == "test@gmail.com"

    def test_account_with_none_email(self):
        """Test creating Account with None email."""
        account = Account(**create_account_data(None))
        assert account.email is None

    def test_account_with_empty_string_email(self):
        """Test creating Account with empty string email fails."""
        with pytest.raises(ValidationError) as exc_info:
            Account(**create_account_data(""))

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("email",)
        assert "The format of the email is invalid" in str(errors[0]["msg"])

    def test_account_with_invalid_email(self):
        """Test creating Account with invalid email fails."""
        with pytest.raises(ValidationError) as exc_info:
            Account(**create_account_data("invalid-email"))

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("email",)
        assert "The format of the email is invalid" in str(errors[0]["msg"])

    def test_account_email_whitespace_stripped(self):
        """Test that email whitespace is stripped by ConstrainedEmail."""
        account = Account(**create_account_data("  test@gmail.com  "))
        assert account.email == "test@gmail.com"
