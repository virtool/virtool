from virtool.handlers import root, jobs, samples, viruses, history, hmm, hosts, account, groups, users

from virtool.dispatcher import websocket_handler


def setup_routes(app):
    app.router.add_get("/api", root.get)

    setup_jobs_routes(app)
    setup_samples_routes(app)
    setup_viruses_routes(app)
    setup_hmm_routes(app)
    setup_hosts_routes(app)
    setup_account_routes(app)
    setup_users_routes(app)
    setup_groups_routes(app)

    setup_websocket_routes(app)


def setup_websocket_routes(app):
    app.router.add_get("/ws", websocket_handler)


def setup_jobs_routes(app):
    app.router.add_get("/api/jobs", jobs.find)
    app.router.add_get("/api/jobs/{job_id}", jobs.get)


def setup_samples_routes(app):
    app.router.add_get("/api/samples", samples.find)
    app.router.add_post("/api/samples", samples.create),

    app.router.add_get("/api/samples/{sample_id}", samples.get),
    app.router.add_put("/api/samples/{sample_id}", samples.update),
    app.router.add_delete("/api/samples/{sample_id}", samples.remove),

    app.router.add_put("/api/samples/{sample_id}/group", samples.set_owner_group),
    app.router.add_put("/api/samples/{sample_id}/rights", samples.set_rights),


def setup_viruses_routes(app):
    app.router.add_get("/api/viruses", viruses.find)
    app.router.add_get("/api/viruses/{virus_id}", viruses.get)
    app.router.add_post("/api/viruses", viruses.create)


def setup_history_routes(app):
    app.router.add_delete("/api/history/{history_id}", history.revert)


def setup_hmm_routes(app):
    app.router.add_get("/api/hmm/annotations", hmm.find)

    app.router.add_get("/api/hmm/annotations/{hmm_id}", hmm.get)
    app.router.add_put("/api/hmm/annotations/{hmm_id}", hmm.update)

    app.router.add_get("/api/hmm/check", hmm.check)
    app.router.add_get("/api/hmm/clean", hmm.clean)


def setup_hosts_routes(app):
    app.router.add_get("/api/hosts", hosts.find)
    app.router.add_post("/api/hosts", hosts.create)

    app.router.add_get("/api/hosts/{host_id}", hosts.get)
    app.router.add_delete("/api/hosts/{host_id}", hosts.remove)


def setup_account_routes(app):
    app.router.add_get("/api/account/settings", account.get_settings)
    app.router.add_put("/api/account/settings", account.update_settings)

    app.router.add_put("/api/account/password", account.change_password)

    app.router.add_get("/api/account/logout", account.logout)


def setup_users_routes(app):
    app.router.add_get("/api/users", users.find)
    app.router.add_post("/api/users", users.create)

    app.router.add_get("/api/users/{user_id}", users.get)
    app.router.add_delete("/api/users/{user_id}", users.remove)

    app.router.add_put("/api/users/{user_id}/reset", users.set_force_reset)
    app.router.add_put("/api/users/{user_id}/password", users.set_password)

    app.router.add_post("/api/users/{user_id}/groups", users.add_group)
    app.router.add_delete("/api/users/{user_id}/groups/{group_id}", users.remove_group)


def setup_groups_routes(app):
    app.router.add_get("/api/groups", groups.find)
    app.router.add_post("/api/groups", groups.create)

    app.router.add_get("/api/groups/{group_id}", groups.get)
    app.router.add_put("/api/groups/{group_id}", groups.update_permissions)
    app.router.add_delete("/api/groups/{group_id}", groups.remove)
