"""
Provides request handlers for managing and viewing analyses.

"""
import aiohttp

import virtool.genbank.http
import virtool.http.proxy
import virtool.http.routes
from virtool.api.response import bad_gateway, json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/genbank/{accession}")
async def get(req):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-style sequence
    document.

    """
    accession = req.match_info["accession"]
    session = req.app["client"]
    settings = req.app["settings"]

    try:
        data = await virtool.genbank.http.fetch(settings, session, accession)

        if data is None:
            return not_found()

        return json_response(data)

    except aiohttp.ClientConnectorError:
        return bad_gateway("Could not reach NCBI")
