import virtool.api.utils


async def migrate_users(app):
    await rename_quick_analyze_field(app["db"])


async def rename_quick_analyze_field(db):
    query = virtool.api.utils.compose_exists_query("settings.quick_analyze_algorithm")

    await db.users.update_many(query, {
        "$rename": {
            "settings.quick_analyze_algorithm": "settings.quick_analyze_workflow"
        }
    })
