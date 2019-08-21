import virtool.users.utils


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
