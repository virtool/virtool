"""
Provides request handlers for accessing GenBank through the web server.

"""

from aiohttp import ClientConnectorError
from aiohttp.web import Response

import virtool.genbank.http
from virtool.api.errors import APINotFound, APIBadGateway
from virtool.api.custom_json import json_response
from virtool.api.routes import Routes
from virtool.utils import get_http_session_from_app

routes = Routes()


@routes.get("/genbank/{accession}")
async def get(req) -> Response:
    """
    Retrieve the Genbank data associated with the given accession and transform it into
    a Virtool-style sequence document.

    """
    accession = req.match_info["accession"]

    try:
        data = await virtool.genbank.http.fetch(
            get_http_session_from_app(req.app), accession
        )

        if data is None:
            raise APINotFound()

        return json_response(data)

    except ClientConnectorError:
        raise APIBadGateway("Could not reach NCBI")
