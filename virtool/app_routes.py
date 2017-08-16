import os
import logging
from aiohttp import web

from virtool.utils import get_static_hash
from virtool.user_login import get_login_template, generate_verification_keys, login_handler
from virtool.handlers import root, jobs, samples, viruses, history, hmm, subtraction, settings, account, groups, users,\
    genbank, status, lifecycle, websocket, resources, analyses, indexes, files, uploads, downloads


logger = logging.getLogger(__name__)


async def index_handler(req):
    static_hash = get_static_hash()

    if not req["session"].user_id:
        keys = generate_verification_keys()

        session_id = req["session"].id

        await req.app["db"].sessions.update_one({"_id": session_id}, {
            "$set": {
                "keys": keys
            }
        })

        html = get_login_template().render(
            key_1=keys[0],
            key_2=keys[1],
            key_3=keys[2],
            hash=static_hash,
            location=req.path
        )

        return web.Response(body=html, content_type="text/html")

    with open("client/dist/index.html") as handle:
        return web.Response(body=handle.read(), content_type="text/html")


def setup_routes(app):
    setup_basic_routes(app)
    setup_file_routes(app)
    setup_basic_api_routes(app)
    setup_jobs_routes(app)
    setup_samples_routes(app)
    setup_analyses_routes(app)
    setup_viruses_routes(app)
    setup_ncbi_routes(app)
    setup_indexes_routes(app)
    setup_history_routes(app)
    setup_hmm_routes(app)
    setup_hmm_routes(app)
    setup_subtraction_routes(app)
    setup_settings_routes(app)
    setup_files_routes(app)
    setup_account_routes(app)
    setup_users_routes(app)
    setup_groups_routes(app)


def setup_basic_routes(app):
    app.router.add_get("/", index_handler)
    app.router.add_get(r"/home{suffix:.*}", index_handler)
    app.router.add_get(r"/jobs{suffix:.*}", index_handler)
    app.router.add_get(r"/samples{suffix:.*}", index_handler)
    app.router.add_get(r"/viruses{suffix:.*}", index_handler)
    app.router.add_get(r"/subtraction{suffix:.*}", index_handler)
    app.router.add_get(r"/settings{suffix:.*}", index_handler)
    app.router.add_get("/ws", websocket.root)
    app.router.add_post("/login", login_handler)

    if os.path.exists("client/dist"):
        app.router.add_static("/static", "client/dist")
    else:
        logger.warning("Could not locate client static files")


def setup_file_routes(app):
    app.router.add_post("/upload/viruses", uploads.upload)
    app.router.add_post("/upload/reads", uploads.upload)
    app.router.add_post("/upload/hmm/profiles", uploads.upload)
    app.router.add_post("/upload/hmm/annotations", uploads.upload)
    app.router.add_post("/upload/host", uploads.upload)

    app.router.add_get("/download/viruses/", viruses.export)
    app.router.add_get("/download/viruses/{virus_id}", downloads.download_virus_sequences)
    app.router.add_get("/download/sequences/{sequence_id}", downloads.download_sequence)
    app.router.add_get("/download/viruses/{virus_id}/isolates/{isolate_id}", downloads.download_isolate_sequences)


def setup_basic_api_routes(app):
    app.router.add_get("/api", root.get)
    app.router.add_get("/api/lifecycle/shutdown", lifecycle.shutdown)
    app.router.add_get("/api/status", status.list_status)


def setup_jobs_routes(app):
    app.router.add_get("/api/jobs", jobs.find)
    app.router.add_get("/api/jobs/{job_id}", jobs.get)
    app.router.add_delete("/api/jobs", jobs.clear)
    app.router.add_delete("/api/jobs/complete", jobs.clear)
    app.router.add_delete("/api/jobs/failed", jobs.clear)
    app.router.add_post("/api/jobs/{job_id}/cancel", jobs.cancel)
    app.router.add_delete("/api/jobs/{job_id}", jobs.remove)
    app.router.add_post("/api/jobs/test", jobs.test_job)
    app.router.add_get("/api/resources", resources.get)
    app.router.add_get("/api/resources/cuda", resources.get_cuda)


def setup_samples_routes(app):
    app.router.add_get("/api/samples", samples.find)
    app.router.add_post("/api/samples", samples.create)
    app.router.add_get("/api/samples/{sample_id}", samples.get)
    app.router.add_patch("/api/samples/{sample_id}", samples.edit)
    app.router.add_delete("/api/samples/{sample_id}", samples.remove)
    app.router.add_get("/api/samples/{sample_id}/analyses", samples.list_analyses)
    app.router.add_post("/api/samples/{sample_id}/analyses", samples.analyze)
    app.router.add_put("/api/samples/{sample_id}/group", samples.set_owner_group)
    app.router.add_patch("/api/samples/{sample_id}/rights", samples.set_rights)


def setup_analyses_routes(app):
    app.router.add_get("/api/analyses/{analysis_id}", analyses.get)


def setup_viruses_routes(app):
    app.router.add_get("/api/viruses", viruses.find)
    app.router.add_get("/api/viruses/{virus_id}", viruses.get)
    app.router.add_post("/api/viruses", viruses.create)
    app.router.add_patch("/api/viruses/{virus_id}", viruses.edit)
    app.router.add_delete("/api/viruses/{virus_id}", viruses.remove)
    app.router.add_get("/api/viruses/{virus_id}/isolates", viruses.list_isolates)
    app.router.add_get("/api/viruses/{virus_id}/isolates/{isolate_id}", viruses.get_isolate)
    app.router.add_post("/api/viruses/{virus_id}/isolates", viruses.add_isolate)
    app.router.add_patch("/api/viruses/{virus_id}/isolates/{isolate_id}", viruses.edit_isolate)
    app.router.add_put("/api/viruses/{virus_id}/isolates/{isolate_id}/default", viruses.set_as_default)
    app.router.add_delete("/api/viruses/{virus_id}/isolates/{isolate_id}", viruses.remove_isolate)
    app.router.add_get("/api/viruses/{virus_id}/isolates/{isolate_id}/sequences", viruses.list_sequences)
    app.router.add_post("/api/viruses/{virus_id}/isolates/{isolate_id}/sequences", viruses.create_sequence)
    app.router.add_get("/api/viruses/{virus_id}/isolates/{isolate_id}/sequences/{sequence_id}", viruses.get_sequence)
    app.router.add_patch("/api/viruses/{virus_id}/isolates/{isolate_id}/sequences/{sequence_id}", viruses.edit_sequence)
    app.router.add_delete("/api/viruses/{virus_id}/isolates/{isolate_id}/sequences/{sequence_id}",
                          viruses.remove_sequence)
    app.router.add_get("/api/viruses/{virus_id}/history", viruses.list_history)


def setup_ncbi_routes(app):
    app.router.add_get("/api/genbank/{accession}", genbank.get)


def setup_indexes_routes(app):
    app.router.add_get("/api/indexes", indexes.find)
    app.router.add_get("/api/indexes/{index_id_or_version}", indexes.get)
    app.router.add_post("/api/indexes", indexes.create)
    app.router.add_get("/api/indexes/{index_id_or_version}/history", indexes.find_history)


def setup_history_routes(app):
    app.router.add_get("/api/history", history.find)
    app.router.add_get("/api/history/{change_id}", history.get)
    app.router.add_delete("/api/history/{change_id}", history.revert)


def setup_hmm_routes(app):
    app.router.add_get("/api/hmm/annotations", hmm.find)

    app.router.add_get("/api/hmm/annotations/{hmm_id}", hmm.get)
    app.router.add_patch("/api/hmm/annotations/{hmm_id}", hmm.update)

    app.router.add_get("/api/hmm/check", hmm.check)
    app.router.add_get("/api/hmm/clean", hmm.clean)


def setup_subtraction_routes(app):
    app.router.add_get("/api/subtraction", subtraction.find)
    app.router.add_get("/api/subtraction/{subtraction_id}", subtraction.get)
    app.router.add_post("/api/subtraction", subtraction.create)


def setup_settings_routes(app):
    app.router.add_get("/api/settings", settings.get_all)
    app.router.add_patch("/api/settings", settings.update)


def setup_files_routes(app):
    app.router.add_get("/api/files", files.find)
    app.router.add_delete("/api/files/{file_id}", files.remove)


def setup_account_routes(app):
    app.router.add_get("/api/account", account.get)
    app.router.add_get("/api/account/settings", account.get_settings)
    app.router.add_patch("/api/account/settings", account.update_settings)
    app.router.add_get("/api/account/logout", account.logout)
    app.router.add_put("/api/account/password", account.change_password)


def setup_users_routes(app):
    app.router.add_get("/api/users", users.find)
    app.router.add_post("/api/users", users.create)
    app.router.add_get("/api/users/{user_id}", users.get)
    app.router.add_delete("/api/users/{user_id}", users.remove)
    app.router.add_put("/api/users/{user_id}/password", users.set_password)
    app.router.add_put("/api/users/{user_id}/reset", users.set_force_reset)
    app.router.add_put("/api/users/{user_id}/primary", users.set_primary_group)
    app.router.add_post("/api/users/{user_id}/groups", users.add_group)
    app.router.add_delete("/api/users/{user_id}/groups/{group_id}", users.remove_group)


def setup_groups_routes(app):
    app.router.add_get("/api/groups", groups.find)
    app.router.add_post("/api/groups", groups.create)
    app.router.add_get("/api/groups/{group_id}", groups.get)
    app.router.add_patch("/api/groups/{group_id}", groups.update_permissions)
    app.router.add_delete("/api/groups/{group_id}", groups.remove)
