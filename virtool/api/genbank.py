"""
Provides request handlers for managing and viewing analyses.

"""
import aiohttp

import virtool.genbank
import virtool.http.proxy
import virtool.http.routes
from virtool.api.utils import json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/genbank/{accession}")
async def get(req):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-style sequence
    document.

    """
    accession = req.match_info["accession"]
    settings = req.app["settings"]

    async with aiohttp.ClientSession() as session:
        gi = await virtool.genbank.search(settings, session, accession)

        print(gi)

        if not gi:
            return not_found()

        data = await virtool.genbank.fetch(settings, session, gi)

        return json_response(data)
