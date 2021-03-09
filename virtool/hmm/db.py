"""
Work with HMM data in the database.

Schema:
- _id (str) a unique ID for the HMM annotation/cluster
- cluster (int) the hmmer cluster number
- count (int) the number of protein sequences in the cluster
- entries (List[Object]) describes the sequences included in the cluster
  - accession (str) the accession for the protein sequence (eg. NP_050260.1)
  - gi (str) the GI for the protein sequence
  - name (str) the human-readable name for the sequence (eg. nuclear egress membrance protein)
  - organism (str) the source organism (eg. Pandoravirus salinus)
- families (Object) describes the incidence of taxonomic families in the cluster - key by family names with counts as values
- genera (Object) describes the incidence of genera in the cluster - key by genus names with counts as values
- hidden (bool) set to true if the annotation is from a deleted HMM dataset but is still referred to in analyses
- length (int) the length of the profile
- mean_entropy (float) see hmmer docs
- name (List[str]) the top three names observed in the member sequences
- total_entropy (float) see hmmer docs

"""
import asyncio
import json
import logging
import os
import shutil

import aiofiles
import aiohttp.client_exceptions
import aiohttp.web
import pymongo.results

import virtool.analyses.utils
import virtool.db.core
import virtool.db.utils
import virtool.errors
import virtool.github
import virtool.hmm.utils
import virtool.http.utils
import virtool.tasks.pg
import virtool.tasks.task
import virtool.types
import virtool.utils

logger = logging.getLogger(__name__)

HMM_REFRESH_INTERVAL = 600

PROJECTION = [
    "_id",
    "cluster",
    "names",
    "count",
    "families"
]


class HMMInstallTask(virtool.tasks.task.Task):
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
    :param task_id: the id for the process document
    :param release: the release to install
    :param user_id: the id of the user making the request

    """
    task_type = "install_hmms"

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [
            self.download,
            self.decompress,
            self.install_profiles,
            self.import_annotations
        ]

        self.temp_path = self.temp_dir.name

    async def download(self):
        release = self.context["release"]
        await virtool.tasks.pg.update(self.pg, self.id, 0, step="download")

        tracker = await self.get_tracker(release["size"])

        path = os.path.join(self.temp_path, "hmm.tar.gz")

        try:
            await virtool.http.utils.download_file(
                self.app,
                release["download_url"],
                path,
                tracker.add
            )
        except (aiohttp.ClientConnectorError, virtool.errors.GitHubError):
            await virtool.tasks.pg.update(
                self.pg,
                self.id,
                error="Could not download HMM data",
                step="unpack"
            )

    async def decompress(self):
        tracker = await self.get_tracker()

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            progress=tracker.step_completed,
            step="unpack"
        )

        await self.run_in_thread(
            virtool.utils.decompress_tgz,
            os.path.join(self.temp_path, "hmm.tar.gz"),
            self.temp_path
        )

    async def install_profiles(self):
        tracker = await self.get_tracker()

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            progress=tracker.step_completed,
            step="install_profiles"
        )

        decompressed_path = os.path.join(self.temp_path, "hmm")

        install_path = os.path.join(self.app["settings"]["data_path"], "hmm", "profiles.hmm")

        await self.run_in_thread(shutil.move, os.path.join(decompressed_path, "profiles.hmm"), install_path)

    async def import_annotations(self):
        release = self.context["release"]
        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            step="import_annotations"
        )

        async with aiofiles.open(os.path.join(self.temp_path, "hmm", "annotations.json"), "r") as f:
            annotations = json.loads(await f.read())

        await purge(self.db, self.app["settings"])

        tracker = await self.get_tracker(len(annotations))

        for annotation in annotations:
            await self.db.hmm.insert_one(dict(annotation, hidden=False))
            await tracker.add(1)

        logger.debug(f"Inserted {len(annotations)} annotations")

        try:
            release_id = int(release["id"])
        except TypeError:
            release_id = release["id"]

        await self.db.status.update_one({"_id": "hmm", "updates.id": release_id}, {
            "$set": {
                "installed": virtool.github.create_update_subdocument(release, True, self.context["user_id"]),
                "updates.$.ready": True
            }
        })

        logger.debug("Update HMM status")
        logger.debug("Finished HMM install task")


async def delete_unreferenced_hmms(db, settings: dict) -> pymongo.results.DeleteResult:
    """
    Deletes all HMM documents that are not used in analyses.

    :param db: the application database client
    :param settings: the application settings
    :return: the delete result

    """
    in_db = await get_hmms_referenced_in_db(db)
    in_files = await get_hmms_referenced_in_files(db, settings)

    referenced_ids = list(in_db.union(in_files))

    delete_result = await db.hmm.delete_many({"_id": {"$nin": referenced_ids}})

    logger.debug(f"Deleted {delete_result.deleted_count} unreferenced HMMs")

    return delete_result


async def get_hmms_referenced_in_files(db, settings: dict) -> set:
    """
    Parse all NuVs JSON results files and return a set of found HMM profile ids. Used for removing unreferenced HMMs
    when purging the collection.

    :param db: the application database object
    :param settings: the application settings
    :return: HMM ids referenced in NuVs result files

    """
    paths = list()

    async for document in db.analyses.find({"workflow": "nuvs", "results": "file"}, ["_id", "sample"]):
        path = virtool.analyses.utils.join_analysis_json_path(
            settings["data_path"],
            document["_id"],
            document["sample"]["id"]
        )

        paths.append(path)

    hmm_ids = set()

    for path in paths:
        async with aiofiles.open(path, "r") as f:
            data = json.loads(await f.read())

        for sequence in data:
            for orf in sequence["orfs"]:
                for hit in orf["hits"]:
                    hmm_ids.add(hit["hit"])

    return hmm_ids


async def get_hmms_referenced_in_db(db) -> set:
    """
    Returns a set of all HMM ids referenced in NuVs analysis documents

    :param db: the application database object
    :return: set of all HMM ids referenced in analysis documents

    """
    cursor = db.analyses.aggregate([
        {"$match": {
            "workflow": "nuvs"
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

    return {a["_id"] async for a in cursor}


async def fetch_and_update_release(app: aiohttp.web.Application, ignore_errors: bool = False) -> dict:
    """
    Return the HMM install status document or create one if none exists.

    :param app: the app object
    :param ignore_errors: ignore possible errors when making GitHub request
    :return: the release

    """
    db = app["db"]
    settings = app["settings"]
    session = app["client"]

    document = await db.status.find_one("hmm", ["installed", "release", "updates"])

    # The latest release stored in the HMM status document.
    release = document.get("release")

    # The ETag for the latest stored release.
    etag = virtool.github.get_etag(release)

    # The currently installed release.
    installed = document.get("installed")

    if installed is True:
        installed = document["updates"][0]

    try:
        # The release dict will only be replaced if there is a 200 response from GitHub. A 304 indicates the release
        # has not changed and `None` is returned from `get_release()`.
        updated = await virtool.github.get_release(
            settings,
            session,
            settings["hmm_slug"],
            etag
        )

        # Release is replace with updated release if an update was found on GitHub.
        if updated:
            release = virtool.hmm.utils.format_hmm_release(
                updated,
                release,
                installed
            )

        # Update the last retrieval timestamp whether or not an update was found on GitHub.
        release["retrieved_at"] = virtool.utils.timestamp()

        # Set and empty error list since the update check was successful.
        await db.status.update_one({"_id": "hmm"}, {
            "$set": {
                "errors": [],
                "installed": installed,
                "release": release
            }
        }, upsert=True)

        logger.debug("Fetched and updated HMM release")

        return release

    except (aiohttp.client_exceptions.ClientConnectorError, virtool.errors.GitHubError) as err:
        errors = list()

        if "ClientConnectorError" in str(err):
            errors = ["Could not reach GitHub"]

        if "404" in str(err):
            errors = ["GitHub repository or release does not exist"]

        if errors and not ignore_errors:
            raise

        await db.status.update_one({"_id": "hmm"}, {
            "$set": {
                "errors": errors,
                "installed": installed
            }
        })

        return release


async def get_status(db) -> dict:
    """
    Get the HMM status document. Remove the updates field and derive a new field: `updating`.

    :param db: the application database object
    :return: the HMM status

    """
    status = await db.status.find_one("hmm")

    status["updating"] = len(status["updates"]) > 1 and status["updates"][-1]["ready"]

    del status["updates"]

    return virtool.utils.base_processor(status)


async def purge(db, settings: dict):
    """
    Delete HMMs that are not used in analyses. Set `hidden` flag on used HMM documents.

    Hidden HMM documents will not be returned in HMM API requests. They are retained only to populate NuVs results.

    :param db: the application database object
    :param settings: the application settings

    """
    await delete_unreferenced_hmms(db, settings)

    await db.hmm.update_many({}, {
        "$set": {
            "hidden": True
        }
    })


async def refresh(app: virtool.types.App):
    """
    Periodically refreshes the release information for HMMs. Intended to be submitted as a job to
    :class:`aiojobs.Scheduler`.

    :param app: the application object

    """
    try:
        logging.debug("Started HMM refresher")

        while True:
            await fetch_and_update_release(app)
            await asyncio.sleep(HMM_REFRESH_INTERVAL)
    except asyncio.CancelledError:
        pass

    logging.debug("Stopped HMM refresher")
