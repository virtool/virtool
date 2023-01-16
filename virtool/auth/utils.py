import sys
from logging import getLogger

import openfga_sdk
from aiohttp import ClientConnectorError
from openfga_sdk import (
    CreateStoreRequest,
    WriteAuthorizationModelRequest,
    TypeDefinition,
    Userset,
    OpenFgaApi,
    WriteRequest,
    TupleKey,
    ApiException,
    TupleKeys,
)
from openfga_sdk.api import open_fga_api

logger = getLogger("openfga")


async def connect_openfga(openfga_host: str, openfga_scheme: str):
    """
    Connects to an OpenFGA server and configures the store id.
    Returns the application client instance.
    """
    configuration = openfga_sdk.Configuration(
        api_scheme=openfga_scheme, api_host=openfga_host
    )

    logger.info("Connecting to OpenFGA")

    try:
        api_client = openfga_sdk.ApiClient(configuration)

        api_instance = open_fga_api.OpenFgaApi(api_client)

        configuration.store_id = await get_or_create_store(api_instance)

        await write_auth_model(api_instance)

    except ClientConnectorError:
        logger.critical("Could not connect")
        sys.exit(1)

    return api_instance


async def get_or_create_store(api_instance: OpenFgaApi):
    """
    Get the OpenFGA Store or create one if it does not exist.

    :return: the store id
    """
    response = await api_instance.list_stores()

    logger.info("Connected to OpenFGA")

    if response.stores:
        logger.info("Found existing store")
        return response.stores[0].id

    body = CreateStoreRequest(
        name="Virtool",
    )
    logger.info("Creating store")
    response = await api_instance.create_store(body)
    return response.id


async def write_auth_model(api_instance: OpenFgaApi):
    """
    Write the authorization model for the OpenFGA Store if it does not exist.
    """
    response = await api_instance.read_authorization_models()

    type_definitions = WriteAuthorizationModelRequest(
        type_definitions=[
            TypeDefinition(
                type="app",
                relations=dict(
                    cancel_job=Userset(
                        this={},
                    ),
                    create_ref=Userset(
                        this={},
                    ),
                    create_sample=Userset(
                        this={},
                    ),
                    modify_hmm=Userset(
                        this={},
                    ),
                    modify_subtraction=Userset(
                        this={},
                    ),
                    remove_file=Userset(
                        this={},
                    ),
                    remove_job=Userset(
                        this={},
                    ),
                    upload_file=Userset(
                        this={},
                    ),
                ),
            ),
            TypeDefinition(
                type="group",
                relations=dict(
                    member=Userset(
                        this={},
                    )
                ),
            ),
        ],
    )

    if (
        response.authorization_models
        and response.authorization_models[0].type_definitions
        == type_definitions.type_definitions
    ):
        return

    await api_instance.write_authorization_model(type_definitions)


async def write_tuple(
    api_instance, user_type, user_id, relations, object_type, object_name
):
    """
    Write a relationship tuple in OpenFGA.
    """

    tuple_list = [
        TupleKey(
            user=f"{user_type}:{user_id}",
            relation=relation,
            object=f"{object_type}:{object_name}",
        )
        for relation in relations
    ]

    body = WriteRequest(writes=TupleKeys(tuple_keys=tuple_list))

    try:
        await api_instance.write(body)
    except ApiException:
        pass
