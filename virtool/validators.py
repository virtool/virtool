import virtool.users


def is_permission_dict(field, value, error):
    if any(key not in virtool.users.PERMISSIONS for key in value):
        error(field, "Keys must be valid permissions")


def has_unique_segment_names(field, value, error):
    if len({seg["name"] for seg in value}) != len(value):
        error(field, "list contains duplicate names")
