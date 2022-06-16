from typing import List, Dict

import virtool.users.utils
from virtool.users.utils import Permission


def merge_group_permissions(groups: List[dict]) -> Dict[str, bool]:
    """
    Return a :class:`dict` of permissions that will be
    inherited by a user belonging to all the passed ``groups``.

    :param groups: a list of group documents.
    :return: a dict keyed by permission names with boolean values
    indicating the state of the permission

    """
    permission_dict = virtool.users.utils.generate_base_permissions()

    for p in Permission:
        for group in groups:
            try:
                if group["permissions"][p.value]:
                    permission_dict[p.value] = True
            except KeyError:
                permission_dict[p.value] = False

    return permission_dict
