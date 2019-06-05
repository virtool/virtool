import logging

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
import virtool.http.auth

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


def setup_routes(app):
    for path in INDEX_PATHS:
        app.router.add_get(path, virtool.http.auth.index_handler)

    app.router.add_get("/ws", virtool.api.websocket.root)
    app.router.add_get("/login", virtool.http.auth.login_get_handler)
    app.router.add_post("/login", virtool.http.auth.login_post_handler)
    app.router.add_get("/reset", virtool.http.auth.reset_get_handler)
    app.router.add_post("/reset", virtool.http.auth.reset_post_handler)

    app.router.add_routes(virtool.api.account.routes)
    app.router.add_routes(virtool.api.analyses.routes)
    app.router.add_routes(virtool.api.caches.routes)
    app.router.add_routes(virtool.api.downloads.routes)
    app.router.add_routes(virtool.api.files.routes)
    app.router.add_routes(virtool.api.genbank.routes)
    app.router.add_routes(virtool.api.groups.routes)
    app.router.add_routes(virtool.api.history.routes)
    app.router.add_routes(virtool.api.hmm.routes)
    app.router.add_routes(virtool.api.indexes.routes)
    app.router.add_routes(virtool.api.jobs.routes)
    app.router.add_routes(virtool.api.otus.routes)
    app.router.add_routes(virtool.api.processes.routes)
    app.router.add_routes(virtool.api.references.routes)
    app.router.add_routes(virtool.api.root.routes)
    app.router.add_routes(virtool.api.samples.routes)
    app.router.add_routes(virtool.api.settings.routes)
    app.router.add_routes(virtool.api.software.routes)
    app.router.add_routes(virtool.api.subtractions.routes)
    app.router.add_routes(virtool.api.uploads.routes)
    app.router.add_routes(virtool.api.users.routes)
