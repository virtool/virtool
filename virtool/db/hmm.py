import asyncio
import json
import logging
import os
import shutil

import aiofiles
import aiohttp.client_exceptions
import semver

import virtool.db.processes
import virtool.db.status
import virtool.db.utils
import virtool.errors
import virtool.github
import virtool.hmm
import virtool.http.utils
import virtool.processes
import virtool.utils

logger = logging.getLogger(__name__)

PROJECTION = [
    "_id",
    "cluster",
    "names",
    "count",
    "families"
]


async def delete_unreferenced_hmms(db):
    """
    Deletes all HMM documents that are not used in analyses.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    """
    cursor = db.analyses.aggregate([
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
    ])

    referenced_ids = list(set([a["_id"] async for a in cursor]))

    delete_result = await db.hmm.delete_many({"_id": {"$nin": referenced_ids}})

    logger.debug("Deleted {} unreferenced HMMs".format(delete_result.deleted_count))


async def fetch_and_update_release(app, ignore_errors=False):
    """
    Return the HMM install status document or create one if none exists.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    :param ignore_errors: ignore possible errors when making GitHub request
    :type ignore_errors: bool

    """
    db = app["db"]
    settings = app["settings"]
    session = app["client"]

    document = await db.status.find_one("hmm", ["release", "installed"])

    release = document.get("release", None)

    installed = document.get("installed", None)

    try:
        etag = release["etag"]
    except (KeyError, TypeError):
        etag = None

    errors = list()

    try:
        updated = await virtool.github.get_release(
            settings,
            session,
            settings["hmm_slug"],
            etag
        )

        # The release dict will only be replaced if there is a 200 response from GitHub. A 304 indicates the release
        # has not changed and `None` is returned from `get_release()`.
        if updated:
            release = virtool.github.format_release(updated)

            release["newer"] = bool(
                release is None or installed is None or (
                        installed and
                        semver.compare(release["name"].lstrip("v"), installed["name"].lstrip("v")) == 1
                )
            )

        release["retrieved_at"] = virtool.utils.timestamp()

        # The `errors` list is emptied and the
        await db.status.update_one({"_id": "hmm"}, {
            "$set": {
                "errors": errors,
                "release": release
            }
        }, upsert=True)

        return release

    except (aiohttp.client_exceptions.ClientConnectorError, virtool.errors.GitHubError) as err:

        if "ClientConnectorError" in str(err):
            errors = ["Could not reach GitHub"]

        if "404" in str(err):
            errors = ["GitHub repository or release does not exist"]

        if errors and not ignore_errors:
            raise

        await db.status.update_one({"_id": "hmm"}, {
            "$set": {
                "errors": errors
            }
        })

        return release


async def get_status(db):
    status = await db.status.find_one("hmm")

    status = virtool.utils.base_processor(status)

    status["updating"] = len(status["updates"]) > 1 and status["updates"][-1]["ready"]

    del status["updates"]

    return status


async def install(app, process_id, release, user_id):
    """
    Runs a background Task that:

        - downloads the official profiles.hmm.gz file
        - decompresses the vthmm.tar.gz file
        - moves the file to the correct data path
        - downloads the official annotations.json.gz file
        - imports the annotations into the database

    Task reports the following stages to the hmm_install status document:

        1. download
        3. decompress
        4. install_profiles
        5. import_annotations

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    :param process_id: the id for the process document
    :type process_id: str

    :param release: the release to install
    :type release: dict

    :param user_id: the id of the user making the request
    :type user_id: str

    """
    db = app["db"]

    await virtool.db.processes.update(db, process_id, 0, step="download")

    progress_tracker = virtool.processes.ProgressTracker(
        db,
        process_id,
        release["size"],
        factor=0.4,
        increment=0.01
    )

    with virtool.utils.get_temp_dir() as tempdir:

        temp_path = str(tempdir)

        path = os.path.join(temp_path, "hmm.tar.gz")

        try:
            await virtool.http.utils.download_file(
                app,
                release["download_url"],
                path,
                progress_tracker.add
            )
        except (aiohttp.ClientConnectorError, virtool.errors.GitHubError):
            await virtool.db.processes.update(
                db,
                process_id,
                errors=["Could not download HMM data"],
                step="unpack"
            )

        await virtool.db.processes.update(
            db,
            process_id,
            progress=0.4,
            step="unpack"
        )

        await app["run_in_thread"](
            virtool.utils.decompress_tgz,
            path,
            temp_path
        )

        await virtool.db.processes.update(
            db,
            process_id,
            progress=0.6,
            step="install_profiles"
        )

        decompressed_path = os.path.join(temp_path, "hmm")

        install_path = os.path.join(app["settings"]["data_path"], "hmm", "profiles.hmm")

        await app["run_in_thread"](shutil.move, os.path.join(decompressed_path, "profiles.hmm"), install_path)

        await virtool.db.processes.update(
            db,
            process_id,
            progress=0.8,
            step="import_annotations"
        )

        async with aiofiles.open(os.path.join(decompressed_path, "annotations.json"), "r") as f:
            annotations = json.loads(await f.read())

        await purge(db)

        progress_tracker = virtool.processes.ProgressTracker(
            db,
            process_id,
            len(annotations),
            factor=0.2,
            initial=0.8
        )

        for annotation in annotations:
            await db.hmm.insert_one(dict(annotation, hidden=False))
            await progress_tracker.add(1)

        logger.debug("Inserted {} annotations".format(len(annotations)))

        try:
            release_id = int(release["id"])
        except TypeError:
            release_id = release["id"]

        await db.status.update_one({"_id": "hmm", "updates.id": release_id}, {
            "$set": {
                "installed": virtool.github.create_update_subdocument(release, True, user_id),
                "updates.$.ready": True
            }
        })

        logger.debug("Update HMM status")

        await virtool.db.processes.update(
            db,
            process_id,
            progress=1
        )

        logger.debug("Finished HMM install process")


async def purge(db):
    await delete_unreferenced_hmms(db)

    await db.hmm.update_many({}, {
        "$set": {
            "hidden": True
        }
    })


async def refresh(app):
    try:
        logging.debug("Started HMM refresher")

        while True:
            await fetch_and_update_release(app)
            await asyncio.sleep(600, loop=app.loop)
    except asyncio.CancelledError:
        pass

    logging.debug("Stopped HMM refresher")
