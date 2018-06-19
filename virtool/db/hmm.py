import asyncio
import json
import logging
import os
import shutil

import aiofiles
import semver

import virtool.db.processes
import virtool.db.status
import virtool.db.utils
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

    referenced_ids = list(set(a["_id"] for a in agg))

    delete_result = await db.hmm.delete_many({"_id": {"$nin": referenced_ids}})

    logger.debug("Deleted {} unreferenced HMMs".format(delete_result.deleted_count))


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

    :param release: the release to install
    :type release: dict

    :param process_id: the id for the process document
    :type process_id: str

    """
    db = app["db"]

    await virtool.db.processes.update(db, process_id, 0, step="download")

    progress_tracker = virtool.processes.ProgressTracker(
        db,
        process_id,
        release["size"],
        0.4
    )

    with virtool.utils.get_temp_dir() as tempdir:

        temp_path = str(tempdir)

        path = os.path.join(temp_path, "hmm.tar.gz")

        await virtool.http.utils.download_file(
            app,
            release["download_url"],
            path,
            progress_tracker.add
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


async def get_hmm_status(db):
    status = await db.status.find_one("hmm")

    status = virtool.utils.base_processor(status)

    status["updating"] = len(status["updates"]) > 1 and status["updates"][-1]["ready"]

    del status["updates"]

    return status


async def fetch_and_update_hmm_release(app):
    """
    Return the HMM install status document or create one if none exists.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    """
    db = app["db"]
    settings = app["settings"]
    session = app["client"]

    etag = None

    document = await db.status.find_one("hmm", ["release", "updates"])

    existing = document.get("release", None)

    try:
        installed = document["updates"][-1]
    except (IndexError, KeyError):
        installed = None

    if existing:
        etag = existing.get("etag", None)

    release = await virtool.github.get_release(settings, session, "virtool/virtool-hmm", etag)

    if release:
        release = virtool.github.format_release(release)
    else:
        release = existing

    release["newer"] = bool(
        release is None or (
            installed and
            semver.compare(release["name"].lstrip("v"), installed["name"].lstrip("v")) == 1
        )
    )

    await db.status.update_one({"_id": "hmm"}, {
        "$set": {
            "release": release
        }
    }, upsert=True)

    return release


async def refresh(app):
    try:
        while True:
            await fetch_and_update_hmm_release(app)
            await asyncio.sleep(600, loop=app.loop)
    except asyncio.CancelledError:
        pass
