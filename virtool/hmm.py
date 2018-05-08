import json
import os
import shutil
import tempfile

import aiofiles

import virtool.errors
import virtool.github
import virtool.updates
import virtool.utils

LATEST_RELEASE_URL = "https://api.github.com/repos/virtool/virtool-hmm/releases/latest"


def file_exists(data_path):
    return os.path.isfile(os.path.join(data_path, "hmm", "profiles.hmm"))


async def get_referenced_hmm_ids(db):
    """
    Returns a list of HMM document ids that are referenced in analyses documents.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :return: HMM document ids
    :rtype: Coroutine[list]

    """
    agg = await db.analyses.aggregate([
        {"$match": {
            "algorithm": "nuvs"
        }},
        {"$project": {
            "results.orfs.hits.hit": True
        }},
        {"$unwind": "$results"},
        {"$unwind": "$results.orfs"},
        {"$unwind": "$results.orfs.hits"},
        {"$group": {
            "_id": "$results.orfs.hits.hit"
        }}
    ]).to_list(None)

    return list(set(a["_id"] for a in agg))


async def update_process(db, progress, step=None, error=None):
    return await virtool.utils.update_status_process(db, "hmm_install", progress, step)


async def get_asset(settings, server_version, username, token):
    """
    Get the asset information associated with the latest HMM release.

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param server_version: the current server version
    :type server_version: str

    :param username: the GitHub username to use for auth
    :type username: str

    :param token: the GitHub token to use for auth
    :type  token: str

    :return: the assets, a dict containing the download url and size in a tuple
    :rtype: Coroutine[dict]

    """
    release = await virtool.github.get(settings, LATEST_RELEASE_URL, server_version, username, token)

    assets = list()

    for asset in release["assets"]:
        assets.append((asset["browser_download_url"], asset["size"]))

    return assets


async def install_official(loop, db, settings, server_version, username=None, token=None):
    """
    Runs a background Task that:

        - downloads the official profiles.hmm.gz file
        - decompresses the profiles.hmm.gz file
        - moves the profiles.hmm file to the correct data path
        - downloads the official annotations.json.gz file
        - imports the annotations into the database

    Task reports the following stages to the hmm_install status document:

        1. check_github
        2. download
        3. decompress
        4. install_profiles
        5. import_annotations

    :param loop: the application event loop

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param server_version: the current server version
    :type server_version: str

    :param username: the GitHub username to use for auth
    :type username: str

    :param token: the GitHub token to use for auth
    :type  token: str

    """
    await update_process(db, 0, step="check_github")

    assets = await get_asset(settings, server_version, username, token)

    await db.status.update_one({"_id": "hmm_install"}, {
        "$set": {
            "download_size": int(assets[0][1])
        }
    })

    await update_process(db, 0.5)

    if len(assets) == 0:
        # Stop the install process if one of the annotation or profile assets are not found.
        return await update_process(db, 1.0, error="Missing HMM asset file")

    async def handler(progress):
        await update_process(db, progress)

    with tempfile.TemporaryDirectory() as temp_path:
        target_path = os.path.join(temp_path, "vthmm.tar.gz")

        url, size = assets[0]

        await update_process(db, 0, step="download")
        await virtool.github.download_asset(settings, url, size, target_path, progress_handler=handler)

        await update_process(db, 0, step="decompress")

        await loop.run_in_executor(None, virtool.github.decompress_asset_file, target_path, temp_path)

        await update_process(db, 0, step="install_profiles")

        decompressed_path = os.path.join(temp_path, "hmm")
        install_path = os.path.join(settings.get("data_path"), "hmm", "profiles.hmm")
        await loop.run_in_executor(None, shutil.move, os.path.join(decompressed_path, "profiles.hmm"), install_path)

        await update_process(db, 0, step="import_annotations")

        async with aiofiles.open(os.path.join(decompressed_path, "annotations.json"), "r") as f:
            annotations = json.loads(await f.read())

        await insert_annotations(db, annotations, handler)

        await db.status.update_one({"_id": "hmm_install"}, {
            "$set": {
                "ready": True
            }
        })

        await update_process(db, 1.0)


async def insert_annotations(db, annotations, progress_handler=None):
    referenced_ids = await get_referenced_hmm_ids(db)

    await db.hmm.delete_many({"_id": {"$nin": referenced_ids}})

    await db.hmm.update_many({}, {
        "$set": {
            "hidden": True
        }
    })

    existing_ids = set(await db.hmm.distinct("_id"))

    count = 0
    total_count = len(annotations)

    for i in range(0, total_count, 30):
        chunk = annotations[i:i + 30]

        for annotation in chunk:
            _id = virtool.utils.random_alphanumeric(8, excluded=existing_ids)
            existing_ids.add(_id)
            annotation.update({
                "_id": _id,
                "hidden": False
            })

        await db.hmm.insert_many(chunk)

        if progress_handler:
            count += len(chunk)
            await progress_handler(count / total_count)
