import virtool.analyses.api
import virtool.api.root
import virtool.caches.api
import virtool.health.api
import virtool.hmm.api
import virtool.indexes.api
import virtool.jobs.api
import virtool.references.api
import virtool.samples.api
import virtool.settings.api
import virtool.subtractions.api
import virtool.tasks.api
import virtool.uploads.api

ROUTES = (
    virtool.analyses.api.routes,
    virtool.caches.api.routes,
    virtool.health.api.routes,
    virtool.hmm.api.routes,
    virtool.indexes.api.routes,
    virtool.api.root.routes,
    virtool.jobs.api.routes,
    virtool.references.api.routes,
    virtool.samples.api.routes,
    virtool.settings.api.routes,
    virtool.subtractions.api.routes,
    virtool.tasks.api.routes,
    virtool.uploads.api.routes,
)
