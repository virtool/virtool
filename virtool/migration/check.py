async def check_data_revision_version(mongo: AsyncIOMotorDatabase):
    """
    Check if the required MongoDB revision has been applied.

    Log a fatal error and exit if the required revision
    has not been applied.

    :param mongo: the application database object
    """

    if not await mongo.migrations.find_one({"revision_id": REQUIRED_MONGODB_REVISION}):
        logger.fatal(
            "The required MongoDB revision has not been applied: %s.",
            REQUIRED_MONGODB_REVISION,
        )
        sys.exit(1)
