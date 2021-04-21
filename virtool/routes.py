import logging
from pathlib import Path

import virtool.account.api
import virtool.analyses.api
import virtool.caches.api
import virtool.dev.api
import virtool.downloads.api
import virtool.genbank.api
import virtool.groups.api
import virtool.history.api
import virtool.hmm.api
import virtool.http.auth
import virtool.http.root
import virtool.http.ws
import virtool.indexes.api
import virtool.jobs.api
import virtool.labels.api
import virtool.otus.api
import virtool.references.api
import virtool.samples.api
import virtool.settings.api
import virtool.subtractions.api
import virtool.tasks.api
import virtool.uploads.api
import virtool.users.api
import virtool.utils

logger = logging.getLogger(__name__)

INDEX_PATHS = [
    "/",
    r"/account{suffix:.*}",
    r"/administration{suffix:.*}",
    r"/home{suffix:.*}",
    r"/hmm{suffix:.*}",
    r"/jobs{suffix:.*}",
    r"/otus{suffix:.*}",
    r"/refs{suffix:.*}",
    r"/samples{suffix:.*}",
    r"/subtraction{suffix:.*}"
]

ROUTES = (
    virtool.account.api.routes,
    virtool.analyses.api.routes,
    virtool.caches.api.routes,
    virtool.downloads.api.routes,
    virtool.genbank.api.routes,
    virtool.groups.api.routes,
    virtool.history.api.routes,
    virtool.hmm.api.routes,
    virtool.indexes.api.routes,
    virtool.jobs.api.routes,
    virtool.labels.api.routes,
    virtool.otus.api.routes,
    virtool.tasks.api.routes,
    virtool.references.api.routes,
    virtool.http.root.routes,
    virtool.samples.api.routes,
    virtool.settings.api.routes,
    virtool.subtractions.api.routes,
    virtool.uploads.api.routes,
    virtool.users.api.routes
)


def setup_routes(app):
    for path in INDEX_PATHS:
        app.router.add_get(path, virtool.http.auth.index_handler)

    app.router.add_get("/ws", virtool.http.ws.root)

    if app["config"]["dev"]:
        logger.info("Enabling development API")
        app.router.add_routes(virtool.dev.api.routes)

    for routes in ROUTES:
        app.router.add_routes(routes)

    static_path = Path.cwd() / "static"

    app.router.add_static("/assets", static_path)
