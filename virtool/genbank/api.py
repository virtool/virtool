"""Provides request handlers for accessing GenBank through the web server."""

from aiohttp import ClientConnectorError

import virtool.genbank.http
from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadGateway, APINotFound
from virtool.api.routes import Routes
from virtool.api.status import R200, R404, R502
from virtool.api.view import APIView
from virtool.utils import get_http_session_from_app

routes = Routes()


@routes.web.view("/genbank/{accession}")
class GenbankView(APIView):
    async def get(self, accession: str) -> R200 | R404 | R502:
        """Retrieve the Genbank data associated with the given accession.

        Transform the data into Virtool-compatible format and return it as JSON.
        """
        try:
            data = await virtool.genbank.http.fetch(
                get_http_session_from_app(self.request.app),
                accession,
            )

            if data:
                return json_response(data)

            raise APINotFound

        except ClientConnectorError:
            raise APIBadGateway("Could not reach NCBI")
