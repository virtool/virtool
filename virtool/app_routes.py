import logging
import mako.template
import os
import secrets
from aiohttp import web

import virtool.api.account
import virtool.api.analyses
import virtool.api.caches
import virtool.api.downloads
import virtool.api.files
import virtool.api.genbank
import virtool.api.groups
import virtool.api.history
import virtool.api.hmm
import virtool.api.indexes
import virtool.api.jobs
import virtool.api.otus
import virtool.api.processes
import virtool.api.references
import virtool.api.root
import virtool.api.samples
import virtool.api.settings
import virtool.api.software
import virtool.api.subtractions
import virtool.api.uploads
import virtool.api.users
import virtool.api.websocket
import virtool.http.auth
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
    virtool.api.account.routes,
    virtool.api.analyses.routes,
    virtool.api.caches.routes,
    virtool.api.downloads.routes,
    virtool.api.files.routes,
    virtool.api.genbank.routes,
    virtool.api.groups.routes,
    virtool.api.history.routes,
    virtool.api.hmm.routes,
    virtool.api.indexes.routes,
    virtool.api.jobs.routes,
    virtool.api.otus.routes,
    virtool.api.processes.routes,
    virtool.api.references.routes,
    virtool.api.root.routes,
    virtool.api.samples.routes,
    virtool.api.settings.routes,
    virtool.api.software.routes,
    virtool.api.subtractions.routes,
    virtool.api.uploads.routes,
    virtool.api.users.routes
)


def setup_routes(app):
    for path in INDEX_PATHS:
        app.router.add_get(path, virtool.http.auth.index_handler)

    app.router.add_get("/ws", virtool.api.websocket.root)

    for routes in ROUTES:
        app.router.add_routes(routes)
