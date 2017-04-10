from virtool.handlers import root, jobs, samples, viruses, history, hmm, hosts, account, groups, users

from virtool.web.dispatcher import websocket_handler


def setup_routes(app):
    app.router.add_get("/ws", websocket_handler)

    app.router.add_get("", root.get)

    # Jobs routes
    app.router.add_get("/api/jobs", jobs.find)
    app.router.add_get("/api/jobs/{job_id}", jobs.get)

    # Samples Routes
    app.router.add_get("/api/samples", samples.find)
    app.router.add_post("/api/samples", samples.create)

    app.router.add_get("/api/samples/{sample_id}", samples.get)
    app.router.add_put("/api/samples/{sample_id}", samples.update)
    app.router.add_delete("/api/samples/{sample_id}", samples.remove)

    app.router.add_put("/api/samples/{sample_id}/group", samples.set_owner_group)
    app.router.add_patch("/api/samples/{sample_id}/rights", samples.set_rights)

    # Viruses Routes
    app.router.add_get("/api/viruses", viruses.find)
    app.router.add_get("/api/viruses/{virus_id}", viruses.get)
    app.router.add_post("/api/viruses", viruses.create)
    app.router.add_patch("/api/viruses/{virus_id}", viruses.edit)
    app.router.add_delete("/api/viruses/{virus_id}", viruses.remove)

    app.router.add_get("/api/viruses/{virus_id}/isolates", viruses.list_isolates)
    app.router.add_get("/api/viruses/{virus_id}/isolates/{isolate_id}", viruses.get_isolate)
    app.router.add_post("/api/viruses/{virus_id}/isolates", viruses.add_isolate)

    app.router.add_patch("/api/viruses/{virus_id}/isolates/{isolate_id}", viruses.edit_isolate)

    app.router.add_delete("/api/viruses/{virus_id}/isolates/{isolate_id}", viruses.remove_isolate)

    app.router.add_get("/api/viruses/{virus_id}/history", viruses.list_history)

    # History Routes
    app.router.add_get("/api/history", history.find)
    app.router.add_get("/api/history/{change_id}", history.get)
    app.router.add_delete("/api/history/{change_id}", history.revert)

    # HMM Routes
    app.router.add_get("/api/hmm/annotations", hmm.find)

    app.router.add_get("/api/hmm/annotations/{hmm_id}", hmm.get)
    app.router.add_patch("/api/hmm/annotations/{hmm_id}", hmm.update)

    app.router.add_get("/api/hmm/check", hmm.check)
    app.router.add_get("/api/hmm/clean", hmm.clean)

    # Hosts Routes
    app.router.add_get("/api/hosts", hosts.find)
    app.router.add_post("/api/hosts", hosts.create)

    app.router.add_get("/api/hosts/{host_id}", hosts.get)
    app.router.add_delete("/api/hosts/{host_id}", hosts.remove)

    # Account Routes
    app.router.add_get("/api/account/settings", account.get_settings)
    app.router.add_patch("/api/account/settings", account.update_settings)

    app.router.add_put("/api/account/password", account.change_password)

    app.router.add_get("/api/account/logout", account.logout)

    # Users routes
    app.router.add_get("/api/users", users.find)
    app.router.add_post("/api/users", users.create)

    app.router.add_get("/api/users/{user_id}", users.get)
    app.router.add_delete("/api/users/{user_id}", users.remove)

    app.router.add_put("/api/users/{user_id}/reset", users.set_force_reset)
    app.router.add_put("/api/users/{user_id}/password", users.set_password)

    app.router.add_post("/api/users/{user_id}/groups", users.add_group)
    app.router.add_delete("/api/users/{user_id}/groups/{group_id}", users.remove_group)

    # Groups Routes
    app.router.add_get("/api/groups", groups.find)
    app.router.add_post("/api/groups", groups.create)

    app.router.add_get("/api/groups/{group_id}", groups.get)
    app.router.add_patch("/api/groups/{group_id}", groups.update_permissions)
    app.router.add_delete("/api/groups/{group_id}", groups.remove)
