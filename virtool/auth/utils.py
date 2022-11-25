import sys
from logging import getLogger

import openfga_sdk
from aiohttp import ClientConnectorError
from openfga_sdk import (
    CreateStoreRequest,
    WriteAuthorizationModelRequest,
    TypeDefinition,
    Userset,
    ApiClient, OpenFgaApi, WriteRequest, TupleKey, ApiException, TupleKeys,
)
from openfga_sdk.api import open_fga_api

logger = getLogger("openfga")


async def connect_openfga(openfga_host: str, openfga_scheme: str):
    """
    Connects to an OpenFGA server and configures the store id.
    Returns the application client object.
    """
    configuration = openfga_sdk.Configuration(
        api_scheme=openfga_scheme, api_host=openfga_host
    )

    logger.info("Connecting to OpenFGA")

    try:
        api_client = openfga_sdk.ApiClient(configuration)

        await check_openfga_version(api_client)

        api_instance = open_fga_api.OpenFgaApi(api_client)

        configuration.store_id = await get_or_create_store(api_instance)

        await write_auth_model(api_instance)

    except ClientConnectorError:
        logger.fatal("Could not connect")
        sys.exit(1)

    return api_client


async def get_or_create_store(api_instance: OpenFgaApi):
    """
    Get the OpenFGA Store or create one if it does not exist.

    :return: the store id
    """

    response = await api_instance.list_stores()

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

    if not response.authorization_models:
        type_definitions = WriteAuthorizationModelRequest(
            type_definitions=[
                TypeDefinition(
                    type="instance",
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
            ],
        )

        await api_instance.write_authorization_model(type_definitions)


async def check_openfga_version(client: ApiClient):
    """
    Check the OpenFGA version.

    :param client: the application OpenFGA client
    """

    logger.info("Found OpenFGA %s", client.user_agent)


async def write_tuple(api_client, user_id, relation, object_type, object_name):
    api_instance = open_fga_api.OpenFgaApi(api_client)

    body = WriteRequest(
        writes=TupleKeys(
            tuple_keys=[TupleKey(
                user=f"user:{user_id}",
                relation=relation,
                object=f"{object_type}:{object_name}",
            ),
            ]
        )
    )

    try:
        await api_instance.write(body)
    except ApiException:
        pass
