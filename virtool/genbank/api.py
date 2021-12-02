"""
Provides request handlers for accessing GenBank through the web server.

"""
import aiohttp
import virtool.genbank.http
from aiohttp.web import HTTPBadGateway
from virtool.api.response import NotFound, json_response
from virtool.http.routes import Routes

routes = Routes()


@routes.get("/genbank/{accession}")
async def get(req):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-style sequence
    document.

    """
    accession = req.match_info["accession"]
    session = req.app["client"]
    config = req.app["config"]

    try:
        data = await virtool.genbank.http.fetch(config, session, accession)

        if data is None:
            raise NotFound()

        return json_response(data)

    except aiohttp.ClientConnectorError:
        raise HTTPBadGateway(text="Could not reach NCBI")
