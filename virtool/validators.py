import re

from email_validator import validate_email, EmailSyntaxError

import virtool.users.utils

RE_HEX_COLOR = re.compile("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")


def strip(value: str) -> str:
    """
    Strip flanking whitespace from the passed string. Used to coerce values in Cerberus validators.

    :param value: the string to strip
    :return: the stripped string

    """
    return value.strip()


def is_permission_dict(field, value, error):
    if any(key not in virtool.users.utils.PERMISSIONS for key in value):
        error(field, "keys must be valid permissions")


def has_unique_segment_names(field, value, error):
    if len({seg["name"] for seg in value}) != len(value):
        error(field, "list contains duplicate names")


def is_valid_hex_color(field, value, error):
    if not RE_HEX_COLOR.match(value):
        error(field, "This is not a valid Hexadecimal color")


def is_valid_email(field, value, error):
    try:
        validate_email(value)
    except EmailSyntaxError:
        error(field, "Not a valid email")
