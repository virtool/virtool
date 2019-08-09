import logging

import virtool.config
import virtool.settings
import virtool.setup.db
import virtool.setup.handlers
import virtool.utils

logger = logging.getLogger(__name__)


def get_defaults() -> dict:
    return {
        "proxy": {
            "proxy": "",
            "ready": False,
            "error": ""
        },
        "db": {
            "db_connection_string": "",
            "db_name": "",
            "ready": False,
            "error": None
        },
        "data": {
            "path": "",
            "ready": False,
            "error": ""
        },
        "watch": {
            "path": "",
            "ready": False,
            "error": ""
        }
    }


def setup_routes(app):
    app.router.add_route("*", r"/api{suffix:.*}", virtool.setup.handlers.unavailable)
    app.router.add_get(r"/setup", virtool.setup.handlers.get_main)
    app.router.add_get(r"/setup/proxy", virtool.setup.handlers.get_proxy)
    app.router.add_post(r"/setup/proxy", virtool.setup.handlers.post_proxy)
    app.router.add_get(r"/setup/db", virtool.setup.handlers.get_db)
    app.router.add_post(r"/setup/db", virtool.setup.handlers.post_db)
    app.router.add_get(r"/setup/data", virtool.setup.handlers.get_path)
    app.router.add_post(r"/setup/data", virtool.setup.handlers.post_path)
    app.router.add_get(r"/setup/watch", virtool.setup.handlers.get_path)
    app.router.add_post(r"/setup/watch", virtool.setup.handlers.post_path)
    app.router.add_get(r"/setup/finish", virtool.setup.handlers.get_finish)
    app.router.add_get(r"/setup/save", virtool.setup.handlers.get_save)
    app.router.add_get(r"/{suffix:.*}", virtool.setup.handlers.redirect)

    try:
        app.router.add_static("/static", app["client_path"])
    except KeyError:
        pass
