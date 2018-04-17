import logging
import os
import sys
from aiohttp import web

import virtool.utils
import virtool.http.login
from virtool.api import root, jobs, samples, kinds, history, hmm, subtractions, settings, account, groups, users,\
    genbank, status, websocket, resources, analyses, indexes, files, uploads, downloads, updates


logger = logging.getLogger(__name__)


async def index_handler(req):
    if req.app["client_path"] is None:
        client_path = await virtool.utils.get_client_path()

        if client_path is None:
            with open(os.path.join(sys.path[0], "templates/client_path_error.html"), "r") as handle:
                return web.Response(body=handle.read(), content_type="text/html")

        req.app["client_path"] = client_path
        req.app.router.add_static("/static", client_path)

    static_hash = virtool.utils.get_static_hash(req.app["client_path"])

    if not req["client"].user_id:
        keys = virtool.http.login.generate_verification_keys()

        session_id = req["client"].session_id

        await req.app["db"].sessions.update_one({"_id": session_id}, {
            "$set": {
                "keys": keys
            }
        })

        html = virtool.http.login.get_login_template().render(
            key_1=keys[0],
            key_2=keys[1],
            key_3=keys[2],
            hash=static_hash,
            location=req.path
        )

        return web.Response(body=html, content_type="text/html")

    with open(os.path.join(req.app["client_path"], "index.html"), "r") as handle:
        return web.Response(body=handle.read(), content_type="text/html")


def setup_routes(app):
    index_paths = [
        "/",
        r"/home{suffix:.*}",
        r"/jobs{suffix:.*}",
        r"/samples{suffix:.*}",
        r"/kinds{suffix:.*}",
        r"/hmm{suffix:.*}",
        r"/subtraction{suffix:.*}",
        r"/settings{suffix:.*}",
        r"/account{suffix:.*}"
    ]

    for path in index_paths:
        app.router.add_get(path, index_handler)

    app.router.add_get("/ws", websocket.root)
    app.router.add_post("/login", virtool.http.login.login_handler)

    app.router.add_get("/api", root.get)
    app.router.add_get("/api/status", status.list_status)

    setup_account_routes(app)
    setup_analyses_routes(app)
    setup_file_routes(app)
    setup_files_routes(app)
    setup_jobs_routes(app)
    setup_kind_routes(app)
    setup_genbank_routes(app)
    setup_groups_routes(app)
    setup_history_routes(app)
    setup_hmm_routes(app)
    setup_indexes_routes(app)
    setup_samples_routes(app)
    setup_settings_routes(app)
    setup_subtraction_routes(app)
    setup_update_routes(app)
    setup_users_routes(app)


def setup_files_routes(app):
    app.router.add_get("/api/files", files.find)
    app.router.add_delete("/api/files/{file_id}", files.remove)


def setup_account_routes(app):
    app.router.add_get("/api/account", account.get)
    app.router.add_patch("/api/account", account.edit)
    app.router.add_get("/api/account/settings", account.get_settings)
    app.router.add_patch("/api/account/settings", account.update_settings)
    app.router.add_get("/api/account/keys", account.get_api_keys)
    app.router.add_post("/api/account/keys", account.create_api_key)
    app.router.add_patch("/api/account/keys/{key_id}", account.update_api_key)
    app.router.add_delete("/api/account/keys/{key_id}", account.remove_api_key)
    app.router.add_delete("/api/account/keys", account.remove_all_api_keys)
    app.router.add_get("/api/account/logout", account.logout)


def setup_analyses_routes(app):
    app.router.add_get("/api/analyses/{analysis_id}", analyses.get)
    app.router.add_delete("/api/analyses/{analysis_id}", analyses.remove)
    app.router.add_put("/api/analyses/{analysis_id}/{sequence_index}/blast", analyses.blast)


def setup_file_routes(app):
    app.router.add_post("/upload/kinds", uploads.upload)
    app.router.add_post("/upload/reads", uploads.upload)
    app.router.add_post("/upload/hmm/profiles", uploads.upload)
    app.router.add_post("/upload/hmm/annotations", uploads.upload)
    app.router.add_post("/upload/subtraction", uploads.upload)

    app.router.add_get("/download/kinds", kinds.export)
    app.router.add_get("/download/kinds/{kind_id}", downloads.download_kind)
    app.router.add_get("/download/sequences/{sequence_id}", downloads.download_sequence)
    app.router.add_get("/download/kinds/{kind_id}/isolates/{isolate_id}", downloads.download_isolate)


def setup_genbank_routes(app):
    app.router.add_get("/api/genbank/{accession}", genbank.get)


def setup_groups_routes(app):
    app.router.add_get("/api/groups", groups.find)
    app.router.add_post("/api/groups", groups.create)
    app.router.add_get("/api/groups/{group_id}", groups.get)
    app.router.add_patch("/api/groups/{group_id}", groups.update_permissions)
    app.router.add_delete("/api/groups/{group_id}", groups.remove)


def setup_history_routes(app):
    app.router.add_get("/api/history", history.find)
    app.router.add_get("/api/history/{change_id}", history.get)
    app.router.add_delete("/api/history/{change_id}", history.revert)


def setup_hmm_routes(app):
    app.router.add_get("/api/hmms", hmm.find)
    app.router.add_get("/api/hmms/install", hmm.get_install)
    app.router.add_patch("/api/hmms/install", hmm.install)
    app.router.add_get("/api/hmms/{hmm_id}", hmm.get)


def setup_indexes_routes(app):
    app.router.add_get("/api/indexes", indexes.find)
    app.router.add_get("/api/indexes/{index_id_or_version}", indexes.get)
    app.router.add_post("/api/indexes", indexes.create)
    app.router.add_get("/api/indexes/{index_id_or_version}/history", indexes.find_history)


def setup_jobs_routes(app):
    app.router.add_get("/api/jobs", jobs.find)
    app.router.add_get("/api/jobs/{job_id}", jobs.get)
    app.router.add_delete("/api/jobs", jobs.clear)
    app.router.add_delete("/api/jobs/complete", jobs.clear)
    app.router.add_delete("/api/jobs/failed", jobs.clear)
    app.router.add_post("/api/jobs/{job_id}/cancel", jobs.cancel)
    app.router.add_delete("/api/jobs/{job_id}", jobs.remove)
    app.router.add_post("/api/jobs/test", jobs.dummy_job)
    app.router.add_get("/api/resources", resources.get)


def setup_kind_routes(app):
    app.router.add_get("/api/kinds", kinds.find)
    app.router.add_get("/api/kinds/import", kinds.get_import)
    app.router.add_post("/api/kinds/import", kinds.import_kinds)
    app.router.add_get("/api/kinds/{kind_id}", kinds.get)
    app.router.add_post("/api/kinds", kinds.create)
    app.router.add_patch("/api/kinds/{kind_id}", kinds.edit)
    app.router.add_delete("/api/kinds/{kind_id}", kinds.remove)
    app.router.add_get("/api/kinds/{kind_id}/isolates", kinds.list_isolates)
    app.router.add_get("/api/kinds/{kind_id}/isolates/{isolate_id}", kinds.get_isolate)
    app.router.add_post("/api/kinds/{kind_id}/isolates", kinds.add_isolate)
    app.router.add_patch("/api/kinds/{kind_id}/isolates/{isolate_id}", kinds.edit_isolate)
    app.router.add_put("/api/kinds/{kind_id}/isolates/{isolate_id}/default", kinds.set_as_default)
    app.router.add_delete("/api/kinds/{kind_id}/isolates/{isolate_id}", kinds.remove_isolate)
    app.router.add_get("/api/kinds/{kind_id}/isolates/{isolate_id}/sequences", kinds.list_sequences)
    app.router.add_post("/api/kinds/{kind_id}/isolates/{isolate_id}/sequences", kinds.create_sequence)
    app.router.add_get("/api/kinds/{kind_id}/isolates/{isolate_id}/sequences/{sequence_id}", kinds.get_sequence)
    app.router.add_patch("/api/kinds/{kind_id}/isolates/{isolate_id}/sequences/{sequence_id}", kinds.edit_sequence)
    app.router.add_delete("/api/kinds/{kind_id}/isolates/{isolate_id}/sequences/{sequence_id}",
                          kinds.remove_sequence)
    app.router.add_get("/api/kinds/{kind_id}/history", kinds.list_history)


def setup_samples_routes(app):
    app.router.add_get("/api/samples", samples.find)
    app.router.add_post("/api/samples", samples.create)
    app.router.add_get("/api/samples/{sample_id}", samples.get)
    app.router.add_patch("/api/samples/{sample_id}", samples.edit)
    app.router.add_delete("/api/samples/{sample_id}", samples.remove)
    app.router.add_get("/api/samples/{sample_id}/analyses", samples.list_analyses)
    app.router.add_post("/api/samples/{sample_id}/analyses", samples.analyze)
    app.router.add_patch("/api/samples/{sample_id}/rights", samples.set_rights)


def setup_settings_routes(app):
    app.router.add_get("/api/settings", settings.get)
    app.router.add_patch("/api/settings", settings.update)
    app.router.add_get("/api/settings/proxy", settings.check_proxy)


def setup_subtraction_routes(app):
    app.router.add_get("/api/subtraction", subtractions.find)
    app.router.add_get("/api/subtraction/{subtraction_id}", subtractions.get)
    app.router.add_post("/api/subtraction", subtractions.create)
    app.router.add_patch("/api/subtraction/{subtraction_id}", subtractions.edit)
    app.router.add_delete("/api/subtraction/{subtraction_id}", subtractions.remove)


def setup_update_routes(app):
    app.router.add_get("/api/updates/software", updates.get)
    app.router.add_post("/api/updates/software", updates.upgrade)


def setup_users_routes(app):
    app.router.add_get("/api/users", users.find)
    app.router.add_post("/api/users", users.create)
    app.router.add_get("/api/users/{user_id}", users.get)
    app.router.add_patch("/api/users/{user_id}", users.edit)
    app.router.add_delete("/api/users/{user_id}", users.remove)
