async def find_and_ensure_install(db, reset=False):
    """
    Return the HMM install status document or create one if none exists.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param reset: force the document to be reset to the starting state
    :type reset: bool

    :return: the HMM install status document
    :rtype: dict

    """
    document = await db.status.find_one({"_id": "hmm_install"})

    if not document or reset:
        document = {
            "_id": "hmm_install",
            "download_size": None,
            "ready": False,
            "process": {
                "progress": 0,
                "step": "check_github"
            }
        }

        await db.status.insert_one(document)

    return document
