from logging import getLogger

import openfga_sdk
from aiohttp import ClientConnectorError
from openfga_sdk import (
    CreateStoreRequest,
    WriteAuthorizationModelRequest,
    TypeDefinition,
    Userset,
)
from openfga_sdk.api import open_fga_api

logger = getLogger("OpenFGA")


async def connect_openfga():
    configuration = openfga_sdk.Configuration(
        api_scheme="http", api_host="localhost:8080"
    )

    logger.info("Connecting to OpenFGA")

    try:
        api_client = openfga_sdk.ApiClient(configuration)
        api_instance = open_fga_api.OpenFgaApi(api_client)

        await create_store(api_instance, configuration)
        await write_auth_model(api_instance)

    except ClientConnectorError:
        logger.fatal("Could not connect")

    return api_client


async def create_store(api_instance, configuration):

    response = await api_instance.list_stores()

    if not response.stores:
        body = CreateStoreRequest(
            name="Virtool",
        )
        response = await api_instance.create_store(body)
        logger.info("Creating store")
        configuration.store_id = response.id
    else:
        configuration.store_id = response.stores[0].id

    logger.info("Configuring store id")


async def write_auth_model(api_instance):
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
        logger.info("Writing authorization model")
