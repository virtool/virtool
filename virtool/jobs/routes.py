import aiohttp.web

from virtool.routes import ROUTES


async def startup_routes(app: aiohttp.web.Application):
    """Add routes to jobs API."""
    for routes in ROUTES:
        app.add_routes(routes.jobs_api)
