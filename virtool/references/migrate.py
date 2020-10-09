import virtool.api.utils
import virtool.types


async def migrate_references(app: virtool.types.App):
    await remove_process_field(app["db"])


async def remove_process_field(db):
    """
    Remove the `process` field from all reference documents. This field was changed to `task`.

    :param db: the application database object

    """
    await db.references.update_many(virtool.api.utils.compose_exists_query("process"), {
        "$unset": {
            "process": ""
        }
    })
