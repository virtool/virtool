from typing import List

import virtool.users.utils


def merge_group_permissions(groups: List[dict]) -> dict:
    """
    Return a :class:`dict` of permissions that will be inherited by a user belonging to all the passed ``groups``.

    :param groups: a list of group documents.
    :return: a dict keyed by permission names with boolean values indicating the state of the permission

    """
    permission_dict = virtool.users.utils.generate_base_permissions()

    for permission_name in virtool.users.utils.PERMISSIONS:
        for group in groups:
            try:
                if group["permissions"][permission_name]:
                    permission_dict[permission_name] = True
            except KeyError:
                permission_dict[permission_name] = False

    return permission_dict
