import virtool.db.migrate
import virtool.db.migrate_shared
import virtool.db.utils
import virtool.types


async def migrate_analyses(app: virtool.types.App):
    """
    Delete unready analyses.

    :param app: the application object

    """
    await virtool.db.utils.delete_unready(app["db"].analyses)
    await virtool.db.migrate_shared.add_subtractions_field(app["db"].analyses)
