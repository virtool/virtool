"""
Work with HMM data in the database.

"""
import asyncio
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Set

import aiofiles
import aiohttp.client_exceptions
from aiohttp import ClientSession

import virtool.analyses.utils
import virtool.errors
import virtool.utils
from virtool.github import get_etag, get_release
from virtool.hmm.utils import format_hmm_release
from virtool.utils import base_processor

logger = logging.getLogger(__name__)

HMM_REFRESH_INTERVAL = 600

PROJECTION = ["_id", "cluster", "names", "count", "families"]


async def get_referenced_hmm_ids(mongo, data_path: Path) -> List[str]:
    """
    List the IDs of HMM documents that are used in analyses.

    :param mongo: the application database client
    :param data_path: the application data path
    :return: a list of unreferenced hmm ids

    """
    in_db, in_files = await asyncio.gather(
        get_hmms_referenced_in_db(mongo),
        get_hmms_referenced_in_files(mongo, data_path),
    )

    return sorted(list(in_db | in_files))


async def get_hmms_referenced_in_files(mongo, data_path: Path) -> Set[str]:
    """
    Parse all NuVs JSON results files and return a set of found HMM profile ids. Used for removing unreferenced HMMs
    when purging the collection.

    :param mongo: the application database object
    :param data_path: the application data path
    :return: hmm ids referenced in nuvs result files

    """
    paths = []

    async for document in mongo.analyses.find(
        {"workflow": "nuvs", "results": "file"}, ["_id", "sample"]
    ):
        path = virtool.analyses.utils.join_analysis_json_path(
            data_path, document["_id"], document["sample"]["id"]
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
    cursor = db.analyses.aggregate(
        [
            {"$match": {"workflow": "nuvs"}},
            {"$project": {"results.orfs.hits.hit": True}},
            {"$unwind": "$results"},
            {"$unwind": "$results.orfs"},
            {"$unwind": "$results.orfs.hits"},
            {"$group": {"_id": "$results.orfs.hits.hit"}},
        ]
    )

    return {a["_id"] async for a in cursor}


async def fetch_and_update_release(
    http_client: ClientSession,
    mongo,
    slug: str,
    ignore_errors: bool = False,
) -> Dict[str, Any]:
    """
    Return the HMM install status document or create one if none exists.

    :param mongo: the application mongo client
    :param http_client: the application http client
    :param slug: the slug for the HMM GitHub repo
    :param ignore_errors: ignore possible errors when making GitHub request
    :return: the release

    """
    document = await mongo.status.find_one("hmm", ["installed", "release", "updates"])

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
        updated = await get_release(http_client, slug, etag)

        # Release is replace with updated release if an update was found on GitHub.
        if updated:
            release = format_hmm_release(updated, release, installed)

        release["retrieved_at"] = virtool.utils.timestamp()

        # Set and empty error list since the update check was successful.
        await mongo.status.update_one(
            {"_id": "hmm"},
            {"$set": {"errors": [], "installed": installed, "release": release}},
            upsert=True,
        )

        logger.debug("Fetched and updated HMM release")

        return release

    except (
        aiohttp.client_exceptions.ClientConnectorError,
        virtool.errors.GitHubError,
    ) as err:
        errors = []

        if "ClientConnectorError" in str(err):
            errors = ["Could not reach GitHub"]

        if "404" in str(err):
            errors = ["GitHub repository or release does not exist"]

        if errors and not ignore_errors:
            raise

        await mongo.status.update_one(
            {"_id": "hmm"}, {"$set": {"errors": errors, "installed": installed}}
        )

        return release


async def generate_annotations_json_file(data_path: Path, mongo) -> Path:
    """
    Generate the HMMs annotation file at `config.data_path/hmm/annotations.json.gz

    :param data_path: the app data path
    :param mongo: the app mongo client
    :return: the path to the annotations json file
    """
    annotations_path = data_path / "hmm" / "annotations.json"
    annotations_path.parent.mkdir(parents=True, exist_ok=True)

    documents = [base_processor(document) async for document in mongo.hmm.find({})]

    async with aiofiles.open(annotations_path, "w") as f:
        await f.write(json.dumps(documents))

    return annotations_path
