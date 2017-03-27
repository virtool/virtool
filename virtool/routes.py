from handlers import groups


def set_routes(app):
    set_groups_routes(app)


def set_groups_routes(app):
    app.router.add_get("/groups", groups.list_groups)
    app.router.add_post("/groups/", groups.add_group)
    app.router.add_get("/groups/{group_id}", groups.get_group)
    app.router.add_put("/groups/{group_id}", groups.update_permissions)
    app.router.add_delete("/groups/{group_id}", groups.remove_group)
