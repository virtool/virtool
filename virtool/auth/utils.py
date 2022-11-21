import sys
from logging import getLogger

import openfga_sdk
from aiohttp import ClientConnectorError
from openfga_sdk import (
    CreateStoreRequest,
    WriteAuthorizationModelRequest,
    TypeDefinition,
    Userset,
    ApiClient,
)
from openfga_sdk.api import open_fga_api

logger = getLogger("openfga")


async def connect_openfga(fga_api_scheme: str, fga_api_host: str):
    """
    Connects to an OpenFGA server and configures the store id.
    Returns the application client object.

    :return: the client object

    """
    configuration = openfga_sdk.Configuration(
        api_scheme=fga_api_scheme, api_host=fga_api_host
    )

    logger.info("Connecting to OpenFGA")

    try:
        api_client = openfga_sdk.ApiClient(configuration)

        await check_openfga_version(api_client)

        api_instance = open_fga_api.OpenFgaApi(api_client)

        store_id = await get_or_create_store(api_instance)

        configuration.store_id = store_id

        await write_auth_model(api_instance)

    except ClientConnectorError:
        logger.fatal("Could not connect")
        sys.exit(1)

    return api_client


async def get_or_create_store(api_instance):
    """
    Get the OpenFGA Store or create one if it does not exist.

    :return: the store id
    """

    response = await api_instance.list_stores()

    if not response.stores:
        body = CreateStoreRequest(
            name="Virtool",
        )
        response = await api_instance.create_store(body)
        logger.info("Creating store")
        store_id = response.id
    else:
        store_id = response.stores[0].id

    return store_id


async def write_auth_model(api_instance):
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
                            this=dict(),
                        ),
                        create_ref=Userset(
                            this=dict(),
                        ),
                        create_sample=Userset(
                            this=dict(),
                        ),
                        modify_hmm=Userset(
                            this=dict(),
                        ),
                        modify_subtraction=Userset(
                            this=dict(),
                        ),
                        remove_file=Userset(
                            this=dict(),
                        ),
                        remove_job=Userset(
                            this=dict(),
                        ),
                        upload_file=Userset(
                            this=dict(),
                        ),
                    ),
                ),
            ],
        )

        await api_instance.write_authorization_model(type_definitions)


async def check_openfga_version(client: ApiClient):
    """
    Check the OpenFGA version.

    :param client: the application client object
    """

    version = client.user_agent

    logger.info("Found OpenFGA %s", version)
