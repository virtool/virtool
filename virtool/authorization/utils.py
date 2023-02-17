import asyncio
import sys
from logging import getLogger
from typing import Union

import openfga_sdk
from aiohttp import ClientConnectorError
from aiohttp.web_request import Request
from openfga_sdk import (
    CreateStoreRequest,
    OpenFgaApi,
    WriteRequest,
    TupleKeys,
    TupleKey,
    ReadRequest,
)
from openfga_sdk.api import open_fga_api

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.permissions import Permission, ResourceType
from virtool.authorization.roles import AdministratorRole
from virtool.types import App

logger = getLogger("authz")


def get_authorization_client_from_app(app: App) -> AuthorizationClient:
    """
    Get the authorization client instance from an application object.
    """
    return app["authorization"]


def get_authorization_client_from_req(req: Request) -> AuthorizationClient:
    """
    Get the authorization client instance from a request object.
    """
    return get_authorization_client_from_app(req.app)


async def delete_tuples(api_instance, object_type: ResourceType, object_id: Union[int, str]):

    response = await api_instance.read(
        ReadRequest(
            tuple_key=TupleKey(object=f"{object_type}:{object_id}"),
        )
    )

    if response.tuples:
        await api_instance.write(
            WriteRequest(
                deletes=TupleKeys(
                    [response_tuple.key for response_tuple in response.tuples]
                )
            )
        )


async def connect_openfga(openfga_host: str, openfga_scheme: str, openfga_store: str):
    """
    Connects to an OpenFGA server and configures the store id.
    Returns the application client instance.
    """
    configuration = openfga_sdk.Configuration(
        api_scheme=openfga_scheme, api_host=openfga_host
    )

    logger.info("Connecting to OpenFGA")

    try:
        api_instance = open_fga_api.OpenFgaApi(openfga_sdk.ApiClient(configuration))

        configuration.store_id = await get_or_create_openfga_store(
            api_instance, openfga_store
        )

        await write_openfga_authorization_model(api_instance)

    except ClientConnectorError:
        logger.fatal("Could not connect to OpenFGA")
        sys.exit(1)

    return api_instance


async def get_or_create_openfga_store(api_instance: OpenFgaApi, openfga_store: str):
    """
    Get the OpenFGA Store or create one if it does not exist.

    :return: the store id
    """
    response = await api_instance.list_stores()

    logger.info("Connected to OpenFGA")

    if response.stores:
        for store in response.stores:
            if store.name == openfga_store:
                logger.info("Found existing OpenFGA store")
                return store.id

    response = await api_instance.create_store(
        CreateStoreRequest(
            name="Virtool",
        )
    )

    logger.info("Created new OpenFGA store")

    return response.id


async def write_openfga_authorization_model(api_instance: OpenFgaApi):
    """
    Write the authorization model for the OpenFGA Store if it does not exist.
    """
    response = await api_instance.read_authorization_models()

    model = {
        "type_definitions": [
            {
                "type": "app",
                "relations": {
                    "base": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": AdministratorRole.USERS.value,
                                    }
                                },
                            ]
                        }
                    },
                    "full": {"this": {}},
                    "settings": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": AdministratorRole.FULL.value,
                                    }
                                },
                            ]
                        }
                    },
                    "spaces": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": AdministratorRole.SETTINGS.value,
                                    }
                                },
                            ]
                        }
                    },
                    "users": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": AdministratorRole.SPACES.value,
                                    }
                                },
                            ]
                        }
                    },
                },
                "metadata": {
                    "relations": {
                        "base": {"directly_related_user_types": [{"type": "user"}]},
                        "full": {"directly_related_user_types": [{"type": "user"}]},
                        "settings": {"directly_related_user_types": [{"type": "user"}]},
                        "spaces": {"directly_related_user_types": [{"type": "user"}]},
                        "users": {"directly_related_user_types": [{"type": "user"}]},
                        "modify_hmm": {"directly_related_user_types": []},
                    }
                },
            },
            {
                "type": "reference",
                "relations": {
                    "build_reference": {
                        "computedUserset": {"object": "", "relation": "builder"}
                    },
                    Permission.CONTRIBUTE_REFERENCE.value: {
                        "computedUserset": {"object": "", "relation": "contributor"}
                    },
                    Permission.DELETE_REFERENCE.value: {
                        "computedUserset": {"object": "", "relation": "manager"}
                    },
                    Permission.UPDATE_REFERENCE.value: {
                        "computedUserset": {"object": "", "relation": "editor"}
                    },
                    "parent": {"this": {}},
                    "builder": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "manager",
                                    }
                                },
                                {
                                    "tupleToUserset": {
                                        "tupleset": {
                                            "object": "",
                                            "relation": "parent",
                                        },
                                        "computedUserset": {
                                            "object": "",
                                            "relation": "reference_builder",
                                        },
                                    }
                                },
                            ]
                        }
                    },
                    "contributor": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "editor",
                                    }
                                },
                                {
                                    "tupleToUserset": {
                                        "tupleset": {
                                            "object": "",
                                            "relation": "parent",
                                        },
                                        "computedUserset": {
                                            "object": "",
                                            "relation": "reference_contributor",
                                        },
                                    }
                                },
                            ]
                        }
                    },
                    "editor": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "builder",
                                    }
                                },
                                {
                                    "tupleToUserset": {
                                        "tupleset": {
                                            "object": "",
                                            "relation": "parent",
                                        },
                                        "computedUserset": {
                                            "object": "",
                                            "relation": "reference_editor",
                                        },
                                    }
                                },
                            ]
                        }
                    },
                    "manager": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "tupleToUserset": {
                                        "tupleset": {
                                            "object": "",
                                            "relation": "parent",
                                        },
                                        "computedUserset": {
                                            "object": "",
                                            "relation": "reference_manager",
                                        },
                                    }
                                },
                                {
                                    "tupleToUserset": {
                                        "tupleset": {
                                            "object": "",
                                            "relation": "parent",
                                        },
                                        "computedUserset": {
                                            "object": "",
                                            "relation": "owner",
                                        },
                                    }
                                },
                            ]
                        }
                    },
                    "viewer": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "contributor",
                                    }
                                },
                                {
                                    "tupleToUserset": {
                                        "tupleset": {
                                            "object": "",
                                            "relation": "parent",
                                        },
                                        "computedUserset": {
                                            "object": "",
                                            "relation": "reference_viewer",
                                        },
                                    }
                                },
                            ]
                        }
                    },
                    "view_reference": {
                        "computedUserset": {"object": "", "relation": "viewer"}
                    },
                },
                "metadata": {
                    "relations": {
                        "build_reference": {"directly_related_user_types": []},
                        "contribute_reference": {"directly_related_user_types": []},
                        "delete_reference": {"directly_related_user_types": []},
                        "update_reference": {"directly_related_user_types": []},
                        "parent": {"directly_related_user_types": [{"type": "space"}]},
                        "builder": {"directly_related_user_types": [{"type": "user"}]},
                        "contributor": {
                            "directly_related_user_types": [{"type": "user"}]
                        },
                        "editor": {"directly_related_user_types": [{"type": "user"}]},
                        "manager": {"directly_related_user_types": [{"type": "user"}]},
                        "viewer": {"directly_related_user_types": [{"type": "user"}]},
                        "view_reference": {"directly_related_user_types": []},
                    }
                },
            },
            {
                "type": "space",
                "relations": {
                    "analyze_sample": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_analyzer",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "build_reference": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_builder",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "contribute_reference": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_builder",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_contributor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "create_label": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "label_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "create_project": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "project_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "project_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "create_sample": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "delete_label": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "label_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "delete_project": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "project_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "delete_reference": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "delete_sample": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "delete_subtraction": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "subtraction_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "update_label": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "label_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "update_project": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "project_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "project_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "update_reference": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_builder",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "update_sample": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "update_subtraction": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "subtraction_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "subtraction_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "create_subtraction": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "subtraction_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "subtraction_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "label_manager": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "member": {
                        "union": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "owner": {"this": {}},
                    "cancel_job": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                                {
                                    "tupleToUserset": {
                                        "tupleset": {
                                            "object": "",
                                            "relation": "parent",
                                        },
                                        "computedUserset": {
                                            "object": "",
                                            "relation": "base",
                                        },
                                    }
                                },
                            ]
                        }
                    },
                    "parent": {"this": {}},
                    "project_editor": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "project_manager": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "project_viewer": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "reference_builder": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "reference_contributor": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "reference_editor": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "reference_manager": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "reference_viewer": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "sample_analyzer": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "sample_editor": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "sample_manager": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "sample_viewer": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "subtraction_editor": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "subtraction_manager": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "subtraction_viewer": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "update_label": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "label_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "view_project": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "project_viewer",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "project_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "view_reference": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_builder",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_contributor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "reference_viewer",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "view_sample": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_analyzer",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "sample_viewer",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "view_subtraction": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "subtraction_viewer",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "subtraction_editor",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "subtraction_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "upload_manager": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "create_upload": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "upload_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "delete_upload": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "upload_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                    "upload_viewer": {
                        "intersection": {
                            "child": [
                                {"this": {}},
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "member",
                                    }
                                },
                            ]
                        }
                    },
                    "view_upload": {
                        "union": {
                            "child": [
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "upload_viewer",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "upload_manager",
                                    }
                                },
                                {
                                    "computedUserset": {
                                        "object": "",
                                        "relation": "owner",
                                    }
                                },
                            ]
                        }
                    },
                },
                "metadata": {
                    "relations": {
                        "analyze_sample": {"directly_related_user_types": []},
                        "build_reference": {"directly_related_user_types": []},
                        "contribute_reference": {"directly_related_user_types": []},
                        "create_label": {"directly_related_user_types": []},
                        "create_project": {"directly_related_user_types": []},
                        "create_sample": {"directly_related_user_types": []},
                        "delete_label": {"directly_related_user_types": []},
                        "delete_project": {"directly_related_user_types": []},
                        "delete_reference": {"directly_related_user_types": []},
                        "delete_sample": {"directly_related_user_types": []},
                        "delete_subtraction": {"directly_related_user_types": []},
                        "update_label": {"directly_related_user_types": []},
                        "update_project": {"directly_related_user_types": []},
                        "update_reference": {"directly_related_user_types": []},
                        "update_sample": {"directly_related_user_types": []},
                        "update_subtraction": {"directly_related_user_types": []},
                        "create_subtraction": {"directly_related_user_types": []},
                        "label_manager": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "member": {"directly_related_user_types": [{"type": "user"}]},
                        "owner": {"directly_related_user_types": [{"type": "user"}]},
                        "cancel_job": {"directly_related_user_types": []},
                        "parent": {"directly_related_user_types": [{"type": "app"}]},
                        "project_editor": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "project_manager": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "project_viewer": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "reference_builder": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "reference_contributor": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "reference_editor": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "reference_manager": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "reference_viewer": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "sample_analyzer": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "sample_editor": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "sample_manager": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "sample_viewer": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "subtraction_editor": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "subtraction_manager": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "subtraction_viewer": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "update_label": {"directly_related_user_types": []},
                        "view_project": {"directly_related_user_types": []},
                        "view_reference": {"directly_related_user_types": []},
                        "view_sample": {"directly_related_user_types": []},
                        "view_subtraction": {"directly_related_user_types": []},
                        "upload_manager": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "create_upload": {"directly_related_user_types": []},
                        "delete_upload": {"directly_related_user_types": []},
                        "upload_viewer": {
                            "directly_related_user_types": [
                                {"type": "user"},
                                {"type": "space", "relation": "member"},
                            ]
                        },
                        "view_upload": {"directly_related_user_types": []},
                    }
                },
            },
            {"type": "user", "relations": {}},
        ],
        "schema_version": "1.1",
    }

    if (
        response.authorization_models
        and response.authorization_models[0].type_definitions
        == model["type_definitions"]
    ):
        logger.info("OpenFGA authorization model is up-to-date.")
        return

    await api_instance.write_authorization_model(model)

    logger.info("Updated OpenFGA authorization model.")
