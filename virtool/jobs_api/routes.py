import aiohttp.web

import virtool.analyses.api
import virtool.indexes.api


def init_routes(app: aiohttp.web.Application):
    """Add routes to jobs API."""
    for routes in (virtool.analyses.api.job_routes,
                   virtool.indexes.api.job_routes):
        app.add_routes(routes)

    return app
