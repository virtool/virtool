from __future__ import annotations

from copy import deepcopy
from typing import List, Dict, Tuple

import virtool.users.utils
from virtool.authorization.permissions import SpacePermission
from virtool.authorization.relationships import GroupPermission
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


def adapt_legacy_permissions_dict(permissions_dict: dict[str, bool]):
    adapted = deepcopy(permissions_dict)

    adapted.pop("remove_job", None)

    adapted["create_reference"] = adapted.pop("create_ref")
    adapted["delete_upload"] = adapted.pop("remove_file")
    adapted["create_upload"] = adapted.pop("upload_file")

    return adapted


def convert_permissions_dict_to_relationships(
    group_id: str,
    permissions_dict: dict[str, bool],
) -> Tuple[List[GroupPermission], List[GroupPermission]]:
    adapted_permissions_dict = adapt_legacy_permissions_dict(permissions_dict)

    adds = [
        GroupPermission(group_id, SpacePermission.from_string(permission))
        for permission, value in adapted_permissions_dict.items()
        if value
    ]

    removes = [
        GroupPermission(group_id, SpacePermission.from_string(permission))
        for permission, value in adapted_permissions_dict.items()
        if not value
    ]

    return adds, removes
