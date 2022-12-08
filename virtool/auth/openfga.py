import asyncio
from typing import Union, List

from openfga_sdk import (
    CheckRequest,
    TupleKey,
    ReadRequest,
    WriteRequest,
    TupleKeys,
    ApiException, OpenFgaApi,
)
from virtool_core.models.enums import Permission

from virtool.auth.utils import read_group_permissions
from virtool.users.utils import generate_base_permissions


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
) -> dict:
    """
    List permissions for a user in OpenFGA.
    """

    permissions = generate_base_permissions()

    body = ReadRequest(
        tuple_key=TupleKey(user=f"user:{user_id}", relation="member", object="group:"),
    )

    response = await api_instance.read(body)

    groups = [relation_tuple.key.object for relation_tuple in response.tuples]

    await asyncio.gather(
        *[
            read_group_permissions(
                api_instance, group, object_type, object_id, permissions
            )
            for group in groups
        ]
    )

    body = ReadRequest(
        tuple_key=TupleKey(user=f"user:{user_id}", object=f"{object_type}:{object_id}")
    )

    response = await api_instance.read(body)

    for relation_tuple in response.tuples:
        permissions.update({relation_tuple.key.relation: True})

    return permissions


async def add_in_open_fga(api_instance: OpenFgaApi, tuple_list: List[TupleKey]):
    """
    Add a permission in OpenFGA.
    """
    body = WriteRequest(writes=TupleKeys(tuple_keys=tuple_list))

    try:
        await api_instance.write(body)
    except ApiException:
        pass


async def remove_in_open_fga(api_instance: OpenFgaApi, tuple_list: List[TupleKey]):
    """
    Remove a permission in OpenFGA.
    """
    body = WriteRequest(deletes=TupleKeys(tuple_keys=tuple_list))

    try:
        await api_instance.write(body)
    except ApiException:
        pass
