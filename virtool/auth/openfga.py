from typing import List, Union

from openfga_sdk import (
    ApiClient,
    CheckRequest,
    TupleKey,
    ReadRequest,
    WriteRequest,
    TupleKeys, ApiException,
)
from openfga_sdk.api import open_fga_api
from virtool_core.models.enums import Permission

from virtool.users.utils import generate_base_permissions


async def check_in_open_fga(
    open_fga: ApiClient,
    user_id: str,
    permission: Permission,
    object_type: str,
    object_id: Union[str, int],
) -> bool:
    """
    Check a permission in OpenFGA.
    """
    api_instance = open_fga_api.OpenFgaApi(open_fga)

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
    open_fga: ApiClient, user_id: str, object_type: str, object_id: Union[str, int]
) -> dict:
    """
    List permissions for a user in OpenFGA.
    """

    api_instance = open_fga_api.OpenFgaApi(open_fga)

    permissions = generate_base_permissions()

    body = ReadRequest(
        tuple_key=TupleKey(user=f"user:{user_id}", relation="member", object="group:"),
    )

    response = await api_instance.read(body)

    groups = [relation_tuple.key.object for relation_tuple in response.tuples]

    for group in groups:
        body = ReadRequest(
            tuple_key=TupleKey(
                user=f"{group}#member", object=f"{object_type}:{object_id}"
            ),
        )

        response = await api_instance.read(body)

        for relation_tuple in response.tuples:
            permissions.update({relation_tuple.key.relation: True})

    body = ReadRequest(
        tuple_key=TupleKey(user=f"user:{user_id}", object=f"{object_type}:{object_id}")
    )

    response = await api_instance.read(body)

    for relation_tuple in response.tuples:
        permissions.update({relation_tuple.key.relation: True})

    return permissions


async def add_group_permissions_in_open_fga(
    open_fga: ApiClient, group_id: str, permissions: List[Permission], object_type: str, object_id: Union[str, int]
):
    """
    Add permissions to a group in OpenFGA.
    """

    api_instance = open_fga_api.OpenFgaApi(open_fga)

    for permission in permissions:

        body = WriteRequest(
                writes=TupleKeys(
                    tuple_keys=[TupleKey(
                        user=f"group:{group_id}#member",
                        relation=permission.name,
                        object=f"{object_type}:{object_id}",
                    ),
                    ]
                )
            )
        try:
            await api_instance.write(body)
        except ApiException:
            pass


async def add_user_permissions_in_open_fga(
    open_fga: ApiClient, user_id: str, permissions: List[Permission], object_type: str, object_id: Union[str, int]
):
    """
    Add permissions for a user in OpenFGA.
    """

    api_instance = open_fga_api.OpenFgaApi(open_fga)

    for permission in permissions:

        body = WriteRequest(
                writes=TupleKeys(
                    tuple_keys=[TupleKey(
                        user=f"user:{user_id}",
                        relation=permission.name,
                        object=f"{object_type}:{object_id}",
                    ),
                    ]
                )
            )
        try:
            await api_instance.write(body)
        except ApiException:
            pass


async def remove_group_permissions_in_open_fga(
    open_fga: ApiClient,
    group_id: str,
    permissions: List[Permission],
    object_type: str,
    object_id: Union[str, id],
):
    """
    Remove permissions from a group in OpenFGA.
    """

    api_instance = open_fga_api.OpenFgaApi(open_fga)

    for permission in permissions:
        body = WriteRequest(
            deletes=TupleKeys(
                tuple_keys=[
                    TupleKey(
                        user=f"group:{group_id}#member",
                        relation=permission.name,
                        object=f"{object_type}:{object_id}",
                    ),
                ],
            ),
        )
        try:
            await api_instance.write(body)
        except ApiException:
            pass


async def remove_user_permissions_in_open_fga(
    open_fga: ApiClient,
    user_id: str,
    permissions: List[Permission],
    object_type: str,
    object_id: Union[str, id],
):
    """
    Remove permissions for a user in OpenFGA.
    """
    api_instance = open_fga_api.OpenFgaApi(open_fga)

    for permission in permissions:
        body = WriteRequest(
            deletes=TupleKeys(
                tuple_keys=[
                    TupleKey(
                        user=f"user:{user_id}",
                        relation=permission.name,
                        object=f"{object_type}:{object_id}",
                    ),
                ],
            ),
        )
        try:
            await api_instance.write(body)
        except ApiException:
            pass
