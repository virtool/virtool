import virtool.account.api
import virtool.administrators.api
import virtool.analyses.api
import virtool.api.root
import virtool.dev.api
import virtool.genbank.api
import virtool.groups.api
import virtool.history.api
import virtool.hmm.api
import virtool.indexes.api
import virtool.jobs.api
import virtool.labels.api
import virtool.messages.api
import virtool.ml.api
import virtool.otus.api
import virtool.references.api
import virtool.samples.api
import virtool.settings.api
import virtool.subtractions.api
import virtool.tasks.api
import virtool.uploads.api
import virtool.users.api
import virtool.ws.route

ROUTES = (
    virtool.account.api.routes,
    virtool.administrators.api.routes,
    virtool.analyses.api.routes,
    virtool.genbank.api.routes,
    virtool.groups.api.routes,
    virtool.history.api.routes,
    virtool.hmm.api.routes,
    virtool.indexes.api.routes,
    virtool.api.root.routes,
    virtool.jobs.api.routes,
    virtool.labels.api.routes,
    virtool.messages.api.routes,
    virtool.ml.api.routes,
    virtool.otus.api.routes,
    virtool.references.api.routes,
    virtool.samples.api.routes,
    virtool.settings.api.routes,
    virtool.subtractions.api.routes,
    virtool.tasks.api.routes,
    virtool.uploads.api.routes,
    virtool.users.api.routes,
)


def setup_routes(app, dev: bool = False) -> None:
    app.router.add_get("/ws", virtool.ws.route.root)

    if dev:
        app.router.add_routes(virtool.dev.api.routes)

    for routes in ROUTES:
        app.router.add_routes(routes)
