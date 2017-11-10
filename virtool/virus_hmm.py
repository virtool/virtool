import os
import pymongo.errors
import subprocess
import tempfile

import virtool.errors
import virtool.github
import virtool.updates
import virtool.utils

PROJECTION = [
    "_id",
    "cluster",
    "label",
    "count",
    "families"
]

LATEST_RELEASE_URL = "https://api.github.com/repos/virtool/virtool-hmm/releases/latest"


async def hmmstat(loop, path):
    """

    :param loop: the application loop
    :param executor: the application executor
    :param path: the path to the profiles.hmm file

    :return: a list of profiles in the file
    :rtype: Coroutine[list]

    """
    if not os.path.isfile(path):
        raise FileNotFoundError("HMM file does not exist")

    command = ["hmmstat", path]

    output = await loop.run_in_executor(None, subprocess.check_output, command)

    result = [line.split() for line in output.decode("utf-8").split("\n") if line and line[0] != "#"]

    return [{
        "cluster": int(line[1].replace("vFam_", "")),
        "count": int(line[3]),
        "length": int(line[5])
    } for line in result]


async def update_process(db, dispatch, progress, step=None, error=None):
    return await virtool.utils.update_status_process(db, dispatch, "hmm_install", progress, step)


async def get_assets(server_version, username, token):
    """
    Get the asset information associated with the latest HMM release.

    Returns data in the format:

    ```
    {
        "annotations": (<url>, <size>),
        "profiles": (<url>, <size>)
    }
    ```

    :param server_version: the current server version
    :type server_version: str

    :param username: the GitHub username to use for auth
    :type username: str

    :param token: the GitHub token to use for auth
    :type  token: str

    :return: the assets, a dict containing the download url and size in a tuple
    :rtype: Coroutine[dict]

    """
    release = await virtool.github.get(LATEST_RELEASE_URL, server_version, username, token)

    assets = dict()

    for asset in release["assets"]:
        download_url = asset["browser_download_url"]

        if "annotations" in download_url:
            assets["annotations"] = (download_url, asset["size"])

        elif "profiles.hmm.gz" in download_url:
            assets["profiles"] = (download_url, asset["size"])

    return assets


async def install_official(loop, db, settings, dispatch, server_version, username=None, token=None):
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
        4. decompress
        5. install_profiles
        6. import_annotations

    :param loop: the application event loop

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param settings: the application Settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param dispatch: the application dispatch method
    :type dispatch: func

    :param server_version: the current server version
    :type server_version: str

    :param username: the GitHub username to use for auth
    :type username: str

    :param token: the GitHub token to use for auth
    :type  token: str

    """
    await update_process(db, dispatch, 0, step="check_github")

    assets = await get_assets(server_version, username, token)

    await update_process(db, dispatch, 0.5)

    if len(assets) == 0:
        # Stop the install process if one of the annotation or profile assets are not found.
        return await update_process(db, dispatch, 1.0, error="Missing HMM asset file")

    async def handler(progress):
        await update_process(db, dispatch, progress)

    with tempfile.TemporaryDirectory() as temp_path:

        profiles_path = os.path.join(temp_path, "profiles.hmm.gz")
        annotations_path = os.path.join(temp_path, "annotations.json.gz")

        target_path = os.path.join(temp_path, "vthmm.tar.gz")

        url, size = assets[0]

        await update_process(db, dispatch, 0, step="download")
        await virtool.github.download_asset(url, size, target_path, progress_handler=handler)

        await update_process(db, dispatch, 0, step="decompress")

        decompressed_path = os.path.join(temp_path, "profiles.hmm")
        await loop.run_in_executor(None, decompress_profiles, profiles_path, decompressed_path)

        await update_process(db, dispatch, 0, step="install_profiles")

        install_path = os.path.join(settings.get("data_path"), "hmm", "profiles.hmm")
        await loop.run_in_executor(None, os.rename, decompressed_path, install_path)

        await update_process(db, dispatch, 0, step="import_annotations")
        annotations = await loop.run_in_executor(None, decompress_annotations, annotations_path)

        await insert_annotations(db, annotations)


async def check_installed(loop, db, settings):
    hmm_dir_path = os.path.join(settings.get("data_path"), "hmm")

    if not os.path.isdir(hmm_dir_path):
        os.mkdir(hmm_dir_path)

    hmm_file_path = os.path.join(hmm_dir_path, "profiles.hmm")

    hmm_stats = await hmmstat(loop, hmm_file_path)

    annotations = await db.hmm.find({}, ["cluster", "count", "length"]).to_list(None)

    clusters_in_file = {entry["cluster"] for entry in hmm_stats}
    clusters_in_database = {entry["cluster"] for entry in annotations}

    # Calculate which cluster ids are unique to the HMM file and/or the annotation database.
    errors["not_in_file"] = list(clusters_in_database - clusters_in_file) or False
    errors["not_in_database"] = list(clusters_in_file - clusters_in_database) or False

    await db.status.update_one("hmm", {
        "$set": errors
    }, upsert=True)

    return errors


async def insert_annotations(db, annotations):
    for i in range(0, len(annotations), 20):
        existing_ids = set(await db.hmms.distinct("_id"))

        chunk = annotations[i:i + 20]

        while True:
            for annotation in chunk:
                annotation["_id"] = virtool.utils.random_alphanumeric(8, excluded=existing_ids)

            try:
                await db.hmms.insert_many(annotations)
                break
            except pymongo.errors.DuplicateKeyError:
                pass
