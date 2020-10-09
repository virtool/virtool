import virtool.types


async def migrate_files(app: virtool.types.App):
    """
    Make all files unreserved. This is only called when the server first starts.

    :param app: the application object

    """
    await app["db"].files.update_many({}, {
        "$set": {
            "reserved": False
        }
    }, silent=True)
