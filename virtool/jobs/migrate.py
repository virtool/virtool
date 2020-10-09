import virtool.jobs.db
import virtool.types


async def migrate_jobs(app: virtool.types.App):
    """
    Delete all unfinished jobs. This is run on application start.

    :param app: the application object

    """
    await virtool.jobs.db.delete_zombies(app["db"])