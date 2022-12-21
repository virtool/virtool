import asyncio
from typing import Union, List

import itertools

from openfga_sdk import (
    CheckRequest,
    TupleKey,
    ReadRequest,
    WriteRequest,
    TupleKeys,
    ApiException,
    OpenFgaApi,
)
from virtool_core.models.enums import Permission

from virtool.auth.relationships import BaseRelationship, GroupPermissions


async def check_in_open_fga(
    api_instance: OpenFgaApi,
    user_id: str,
    permission: Permission,
    object_type: str,
    object_id: Union[str, int],
) -> bool:
    """
    Check a permission in OpenFGA.
    """

    body = CheckRequest(
        tuple_key=TupleKey(
            user=f"user:{user_id}",
            relation=permission.name,
            object=f"{object_type}:{object_id}",
        ),
    )

    response = await api_instance.check(body)

    return response.allowed


async def list_permissions_in_open_fga(
    api_instance: OpenFgaApi, user_id: str, object_type: str, object_id: Union[str, int]
) -> List[Permission]:
    """
    List permissions for a user in OpenFGA.
    """

    groups = await list_groups(api_instance, user_id)

    result = await asyncio.gather(
        *[
            list_group_permissions(api_instance, group, object_type, object_id)
            for group in groups
        ]
    )
    permissions = list(itertools.chain(*result))

    body = ReadRequest(
        tuple_key=TupleKey(user=f"user:{user_id}", object=f"{object_type}:{object_id}")
    )

    response = await api_instance.read(body)

    for relation_tuple in response.tuples:
        permissions.append(relation_tuple.key.relation)

    return sorted(permissions)


async def add_in_open_fga(api_instance: OpenFgaApi, relationship: BaseRelationship):
    """
    Add relationship tuples in OpenFGA.
    """
    group_membership = ""

    if isinstance(relationship, GroupPermissions):
        group_membership = "#member"

    body = WriteRequest(
        writes=TupleKeys(
            tuple_keys=[
                TupleKey(
                    user=f"{relationship.user_type}:{relationship.user_id}{group_membership}",
                    relation=relation,
                    object=f"{relationship.object_type}:{relationship.object_name}",
                )
                for relation in relationship.relations
            ]
        )
    )

    try:
        await api_instance.write(body)
    except ApiException:
        pass


async def remove_in_open_fga(api_instance: OpenFgaApi, relationship: BaseRelationship):
    """
    Remove relationship tuples in OpenFGA.
    """
    group_membership = ""

    if isinstance(relationship, GroupPermissions):
        group_membership = "#member"

    body = WriteRequest(
        deletes=TupleKeys(
            tuple_keys=[
                TupleKey(
                    user=f"{relationship.user_type}:{relationship.user_id}{group_membership}",
                    relation=relation,
                    object=f"{relationship.object_type}:{relationship.object_name}",
                )
                for relation in relationship.relations
            ]
        )
    )

    try:
        await api_instance.write(body)
    except ApiException:
        pass


async def list_group_permissions(
    api_instance: OpenFgaApi,
    group: str,
    object_type: str,
    object_id: Union[str, int],
) -> List[Permission]:
    """
    List the permissions for a group in OpenFGA.
    """
    body = ReadRequest(
        tuple_key=TupleKey(user=f"{group}#member", object=f"{object_type}:{object_id}"),
    )

    response = await api_instance.read(body)

    return [relation_tuple.key.relation for relation_tuple in response.tuples]


async def list_groups(api_instance: OpenFgaApi, user_id: str) -> List[str]:
    """
    Return a list of groups the user is a member of in OpenFGA.
    """

    body = ReadRequest(
        tuple_key=TupleKey(user=f"user:{user_id}", relation="member", object="group:"),
    )

    response = await api_instance.read(body)

    groups = [relation_tuple.key.object for relation_tuple in response.tuples]

    return groups
