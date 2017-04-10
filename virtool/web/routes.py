from virtool.handlers import root, jobs, samples, viruses, history, hmm, hosts, account, groups, users

from virtool.web.dispatcher import websocket_handler


def setup_root_routes(app):
    app.router.add_get("/ws", websocket_handler)


def setup_api_routes(app):

    app.router.add_get("", root.get, name="root-get")

    app.router.add_get("/jobs", jobs.find, name="jobs-find")
    app.router.add_get("/jobs/{job_id}", jobs.get, name="jobs-get")

    # Samples Routes
    app.router.add_get("/samples", samples.find, name="samples-find")
    app.router.add_post("/samples", samples.create, name="samples-create")

    app.router.add_get("/samples/{sample_id}", samples.get, name="samples-get")
    app.router.add_put("/samples/{sample_id}", samples.update, name="samples-update")
    app.router.add_delete("/samples/{sample_id}", samples.remove, name="samples-delete")

    app.router.add_put("/samples/{sample_id}/group", samples.set_owner_group, name="samples-set-owner-group")
    app.router.add_patch("/samples/{sample_id}/rights", samples.set_rights, name="samples-set-rights")

    # Viruses Routes
    app.router.add_get("/viruses", viruses.find, name="viruses-find")
    app.router.add_get("/viruses/{virus_id}", viruses.get, name="viruses-get")
    app.router.add_post("/viruses", viruses.create, name="viruses-create")
    app.router.add_patch("/viruses/{virus_id}", viruses.edit, name="viruses-edit")
    app.router.add_delete("/viruses/{virus_id}", viruses.remove, name="viruses-remove")

    app.router.add_get("/viruses/{virus_id}/isolates", viruses.list_isolates, name="viruses-list-isolates")
    app.router.add_get("/viruses/{virus_id}/isolates/{isolate_id}", viruses.get_isolate, name="viruses-get-isolate")
    app.router.add_post("/viruses/{virus_id}/isolates", viruses.add_isolate, name="viruses-add-isolate")

    app.router.add_patch("/viruses/{virus_id}/isolates/{isolate_id}", viruses.edit_isolate,
                         name="viruses-edit-isolate")

    app.router.add_delete("/viruses/{virus_id}/isolates/{isolate_id}", viruses.remove_isolate,
                          name="viruses-remove-isolate")

    app.router.add_get("/viruses/{virus_id}/history", viruses.list_history, name="viruses-list-history")

    # History Routes
    app.router.add_get("/history", history.find, name="history-find")
    app.router.add_get("/history/{change_id}", history.get, name="history-get")
    app.router.add_delete("/history/{change_id}", history.revert, name="history-revert")

    # HMM Routes
    app.router.add_get("/hmm/annotations", hmm.find, name="hmm-find")

    app.router.add_get("/hmm/annotations/{hmm_id}", hmm.get, name="hmm-get")
    app.router.add_patch("/hmm/annotations/{hmm_id}", hmm.update, name="hmm-update")

    app.router.add_get("/hmm/check", hmm.check, name="hmm-check")
    app.router.add_get("/hmm/clean", hmm.clean, name="hmm-clean")

    # Hosts Routes
    app.router.add_get("/hosts", hosts.find)
    app.router.add_post("/hosts", hosts.create)

    app.router.add_get("/hosts/{host_id}", hosts.get)
    app.router.add_delete("/hosts/{host_id}", hosts.remove)

    # Account Routes
    app.router.add_get("/account/settings", account.get_settings)
    app.router.add_patch("/account/settings", account.update_settings)

    app.router.add_put("/account/password", account.change_password)

    app.router.add_get("/account/logout", account.logout)

    # Users routes
    app.router.add_get("/users", users.find)
    app.router.add_post("/users", users.create)

    app.router.add_get("/users/{user_id}", users.get)
    app.router.add_delete("/users/{user_id}", users.remove)

    app.router.add_put("/users/{user_id}/reset", users.set_force_reset)
    app.router.add_put("/users/{user_id}/password", users.set_password)

    app.router.add_post("/users/{user_id}/groups", users.add_group)
    app.router.add_delete("/users/{user_id}/groups/{group_id}", users.remove_group)

    # Groups Routes
    app.router.add_get("/groups", groups.find)
    app.router.add_post("/groups", groups.create)

    app.router.add_get("/groups/{group_id}", groups.get)
    app.router.add_patch("/groups/{group_id}", groups.update_permissions)
    app.router.add_delete("/groups/{group_id}", groups.remove)
