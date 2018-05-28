import json
import os
import shutil

import aiofiles

import virtool.db.processes
import virtool.db.status
import virtool.github
import virtool.hmm
import virtool.http.utils
import virtool.processes
import virtool.utils

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

    await db.hmm.delete_many({"_id": {"$nin": referenced_ids}})


async def install_official(app, process_id):
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

    """
    db = app["db"]

    document = await virtool.db.status.fetch_and_update_hmm_release(app)

    release = document["latest_release"]

    await virtool.db.processes.update(db, process_id, 0, step="download")

    progress_tracker = virtool.processes.ProgressTracker(
        db,
        process_id,
        release["size"],
        0.5,
        initial=0
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

        await virtool.db.processes.update(db, process_id, progress=0.5, step="decompress")

        await app["run_in_thread"](
            virtool.utils.decompress_tgz,
            path,
            temp_path
        )

        await virtool.db.processes.update(db, process_id, progress=0.7, step="install_profiles")

        decompressed_path = os.path.join(temp_path, "hmm")

        install_path = os.path.join(app["settings"]["data_path"], "hmm", "profiles.hmm")

        await app["run_in_thread"](shutil.move, os.path.join(decompressed_path, "profiles.hmm"), install_path)

        await virtool.db.processes.update(db, process_id, progress=0.8, step="import_annotations")

        async with aiofiles.open(os.path.join(decompressed_path, "annotations.json"), "r") as f:
            annotations = json.loads(await f.read())

        await delete_unreferenced_hmms(db)

        await db.hmm.update_many({}, {
            "$set": {
                "hidden": True
            }
        })

        progress_tracker = virtool.processes.ProgressTracker(
            db,
            process_id,
            len(annotations),
            increment=0.05,
            factor=0.2
        )

        for annotation in annotations:
            await db.hmm.insert_one(dict(annotation, hidden=False))
            await progress_tracker.add(1)

        await db.status.update_one({"_id": "hmm"}, {
            "$set": {
                "installed": True
            }
        })

        await virtool.db.processes.update(db, process_id, progress=1)
