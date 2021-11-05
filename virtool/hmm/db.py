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
from pathlib import Path
from typing import List

import aiofiles
import aiohttp.client_exceptions
import pymongo.results
from aiohttp.web import Application

import virtool.analyses.utils
import virtool.errors
import virtool.utils
from virtool.github import get_etag, get_release
from virtool.hmm.utils import format_hmm_release
from virtool.types import App

logger = logging.getLogger(__name__)

HMM_REFRESH_INTERVAL = 600

PROJECTION = [
    "_id",
    "cluster",
    "names",
    "count",
    "families"
]


async def delete_unreferenced_hmms(db, config) -> pymongo.results.DeleteResult:
    """
    Deletes all HMM documents that are not used in analyses.

    :param db: the application database client
    :param config: the application configuration
    :return: the delete result

    """
    in_db = await get_hmms_referenced_in_db(db)
    in_files = await get_hmms_referenced_in_files(db, config)

    referenced_ids = list(in_db.union(in_files))

    delete_result = await db.hmm.delete_many({"_id": {"$nin": referenced_ids}})

    logger.debug(f"Deleted {delete_result.deleted_count} unreferenced HMMs")

    return delete_result


async def get_hmms_referenced_in_files(db, config) -> set:
    """
    Parse all NuVs JSON results files and return a set of found HMM profile ids. Used for removing unreferenced HMMs
    when purging the collection.

    :param db: the application database object
    :param config: the application configuration
    :return: HMM ids referenced in NuVs result files

    """
    paths = list()

    async for document in db.analyses.find({"workflow": "nuvs", "results": "file"}, ["_id", "sample"]):
        path = virtool.analyses.utils.join_analysis_json_path(
            config.data_path,
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


async def fetch_and_update_release(app: Application, ignore_errors: bool = False) -> dict:
    """
    Return the HMM install status document or create one if none exists.

    :param app: the app object
    :param ignore_errors: ignore possible errors when making GitHub request
    :return: the release

    """
    db = app["db"]
    session = app["client"]

    document = await db.status.find_one("hmm", ["installed", "release", "updates"])

    # The latest release stored in the HMM status document.
    release = document.get("release")

    # The ETag for the latest stored release.
    etag = get_etag(release)

    # The currently installed release.
    installed = document.get("installed")

    if installed is True:
        installed = document["updates"][0]

    try:
        # The release dict will only be replaced if there is a 200 response from GitHub. A 304 indicates the release
        # has not changed and `None` is returned from `get_release()`.
        updated = await get_release(
            app["config"],
            session,
            app["settings"].hmm_slug,
            etag
        )

        # Release is replace with updated release if an update was found on GitHub.
        if updated:
            release = format_hmm_release(
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


async def purge(db, config):
    """
    Delete HMMs that are not used in analyses. Set `hidden` flag on used HMM documents.

    Hidden HMM documents will not be returned in HMM API requests. They are retained only to populate NuVs results.

    :param db: the application database object
    :param config: the application configuration

    """
    await delete_unreferenced_hmms(db, config)

    await db.hmm.update_many({}, {
        "$set": {
            "hidden": True
        }
    })


async def refresh(app: App):
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


async def get_hmm_documents(db) -> List[dict]:
    """
    Get a list of all HMM documents currently available in the database.
    :param db: The database object.
    :return: A list of HMM documents.
    """
    all_documents = db.hmm.find({})
    return [virtool.utils.base_processor(document) async for document in all_documents]


async def generate_annotations_json_file(app: App) -> Path:
    """
    Generate the HMMs annotation file at `config.data_path/hmm/annotations.json.gz

    :param app: The app object.
    :return: The path to the compressed annotations json file.
    """
    config, db = app["config"], app["db"]

    annotations_path = config.data_path / "hmm/annotations.json"
    annotations_path.parent.mkdir(parents=True, exist_ok=True)

    hmm_documents = await get_hmm_documents(db)

    async with aiofiles.open(annotations_path, "w") as f:
        await f.write(json.dumps(hmm_documents))

    return annotations_path
