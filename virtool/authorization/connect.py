import sys

from aiohttp import ClientConnectorError
from openfga_sdk import ApiClient as OpenFgaApiClient
from openfga_sdk import Configuration as OpenFgaConfiguration
from openfga_sdk import OpenFgaApi

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.openfga import (
    get_or_create_openfga_store,
    logger,
    write_openfga_authorization_model,
)


async def connect_openfga(
    openfga_host: str,
    openfga_scheme: str,
    openfga_store_name: str,
) -> OpenFgaApi:
    """Connects to an OpenFGA server and configures the store id.
    Returns the application client instance.
    """
    configuration = OpenFgaConfiguration(
        api_scheme=openfga_scheme,
        api_host=openfga_host,
    )

    logger.info("connecting to openfga")

    try:
        api_instance = OpenFgaApi(OpenFgaApiClient(configuration))

        configuration.store_id = await get_or_create_openfga_store(
            api_instance,
            openfga_store_name,
        )

        await write_openfga_authorization_model(api_instance)

    except ClientConnectorError:
        logger.critical("could not connect to openfga")
        sys.exit(1)

    return api_instance


async def connect_authorization_client(
    openfga_host: str,
    openfga_scheme: str,
    openfga_store_name: str,
) -> AuthorizationClient:
    """Connects to an OpenFGA server and configures the store id.
    Returns the application client instance.
    """
    openfga_api = await connect_openfga(
        openfga_host,
        openfga_scheme,
        openfga_store_name,
    )

    return AuthorizationClient(openfga_api)
