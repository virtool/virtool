from virtool import handlers_samples, handlers_hmm, handlers_hosts, handlers_account, handlers_groups


def setup_routes(app):
    setup_samples_routes(app)
    setup_hosts_routes(app)
    setup_account_routes(app)
    setup_groups_routes(app)


def setup_samples_routes(app):
    app.router.add_get("/samples", handlers_samples.find)
    app.router.add_post("/samples", handlers_samples.create),

    app.router.add_get("/samples/{sample_id}", handlers_samples.get),
    app.router.add_put("/samples/{sample_id}", handlers_samples.update),
    app.router.add_delete("/samples/{sample_id}", handlers_samples.remove),

    app.router.add_put("/samples/{sample_id}/group", handlers_samples.set_owner_group),
    app.router.add_put("/samples/{sample_id}/rights", handlers_samples.set_rights),


def setup_hmm_routes(app):
    app.router.add_get("/hmm", handlers_hmm.find)

    app.router.add_get("/hmm/{hmm_id}", handlers_hmm.get)
    app.router.add_put("/hmm/{hmm_id}", handlers_hmm.update)

    app.router.add_get("/hmm/check", handlers_hmm.check)
    app.router.add_get("/hmm/clean", handlers_hmm.clean)


def setup_hosts_routes(app):
    app.router.add_get("/hosts", handlers_hosts.find)
    app.router.add_post("/hosts", handlers_hosts.create)

    app.router.add_get("/hosts/{host_id}", handlers_hosts.get)
    app.router.add_delete("/hosts/{host_id}", handlers_hosts.remove)


def setup_account_routes(app):
    app.router.add_get("/account/settings", handlers_account.get_settings)
    app.router.add_put("/account/settings", handlers_account.update_settings)
    app.router.add_put("/account/password", handlers_account.change_password)
    app.router.add_get("/account/logout", handlers_account.logout)


def setup_groups_routes(app):
    app.router.add_get("/groups", handlers_groups.find)
    app.router.add_post("/groups", handlers_groups.create)

    app.router.add_get("/groups/{group_id}", handlers_groups.get)
    app.router.add_put("/groups/{group_id}", handlers_groups.update_permissions)
    app.router.add_delete("/groups/{group_id}", handlers_groups.remove)

