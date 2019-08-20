import virtool.users


def merge_group_permissions(groups):
    """
    Return a :class:`dict` of permissions that will be inherited by a user belonging to all the passed ``groups``.

    :param groups: a list of group documents.
    :return: a dict keyed by permission names with boolean values indicating the state of the permission

    """
    permission_dict = virtool.users.generate_base_permissions()

    for permission_name in virtool.users.PERMISSIONS:
        for group in groups:
            try:
                if group["permissions"][permission_name]:
                    permission_dict[permission_name] = True
            except KeyError:
                permission_dict[permission_name] = False

    return permission_dict
