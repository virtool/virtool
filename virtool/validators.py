import re

from email_validator import validate_email, EmailSyntaxError

from virtool.users.utils import PERMISSIONS

RE_HEX_COLOR = re.compile("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")


def strip(value: str) -> str:
    """
    Strip flanking whitespace from the passed string. Used to coerce values in Cerberus validators.

    :param value: the string to strip
    :return: the stripped string

    """
    return value.strip()


def is_permission_dict(field: str, value: dict, error: callable):
    """
    Checks that all keys included in permissions dictionary are valid permissions.

    If invalid key is found, error message is updated to "keys must be valid permissions"

    :param field: permissions field to check
    :param value: permissions dictionary value
    :param error: points to the calling validator’s _error method
    """
    if any(key not in PERMISSIONS for key in value):
        error(field, "keys must be valid permissions")


def has_unique_segment_names(field: str, value: list, error: callable):
    """
    Checks that no duplicate names are used for segment names in list

    If duplicate names are found, error message is updated to  "list contains duplicate names"

    :param field: field to check
    :param value: list value
    :param error: points to the calling validator’s _error method
    """
    if len({seg["name"] for seg in value}) != len(value):
        error(field, "list contains duplicate names")


def is_valid_hex_color(field: str, value: str, error: callable):
    """
    Checks that color is a valid Hexadecimal color, performs check using regex format comparison

    If color is an invalid Hexadecimal color, error message is updated to "This is not a valid Hexadecimal color"

    :param field: color field to check
    :param value: color string value
    :param error: points to the calling validator’s _error method
    """
    if not RE_HEX_COLOR.match(value):
        error(field, "This is not a valid Hexadecimal color")


def is_valid_email(field: str, value: str, error: callable):
    """
    Checks that email is a valid email according to email_validator.validate_email

    If email is invalid, error message is updated to "Not a valid email"

    :param field: email field to check
    :param value: email string value
    :param error: points to the calling validator’s _error method
    """
    try:
        validate_email(value)
    except EmailSyntaxError:
        error(field, "Not a valid email")
