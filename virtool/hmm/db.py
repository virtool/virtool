"""Work with HMM data in the database."""

import asyncio
import json

import aiohttp.client_exceptions
from aiohttp import ClientSession
from structlog import get_logger

import virtool.utils
from virtool.analyses.utils import analysis_result_key
from virtool.errors import GitHubError
from virtool.github import get_etag, get_release
from virtool.hmm.utils import format_hmm_release
from virtool.mongo.core import Mongo
from virtool.storage.protocol import StorageBackend
from virtool.types import Document
from virtool.utils import base_processor

logger = get_logger("hmms")

HMMS_REFRESH_INTERVAL = 600
"""How frequently the HMMs should be refreshed from the GitHub repository.

There is currently only one version of HMM data and refreshes after the initial install
of the data do nothing.
"""

HMMS_PROJECTION = ["_id", "cluster", "names", "count", "families"]
"""A MongoDB projection for HMM document lists."""


async def get_referenced_hmm_ids(mongo: Mongo, storage: StorageBackend) -> list[str]:
    """List the IDs of HMM documents that are used in analyses.

    :param mongo: the application database client
    :param storage: the storage backend
    :return: a list of unreferenced hmm ids

    """
    in_db, in_files = await asyncio.gather(
        get_hmms_referenced_in_db(mongo),
        get_hmms_referenced_in_files(mongo, storage),
    )

    return sorted(list(in_db | in_files))


async def get_hmms_referenced_in_files(
    mongo: Mongo,
    storage: StorageBackend,
) -> set[str]:
    """Parse all NuVs JSON results files and return a set of found HMM profile ids.

    Used for removing unreferenced HMMs when purging the collection.

    :param mongo: the application database object
    :param storage: the storage backend
    :return: hmm ids referenced in nuvs result files

    """
    keys = []

    async for document in mongo.analyses.find(
        {"workflow": "nuvs", "results": "file"},
        ["_id", "sample"],
    ):
        keys.append(
            analysis_result_key(document["_id"], document["sample"]["id"]),
        )

    hmm_ids = set()

    for key in keys:
        chunks = []
        async for chunk in storage.read(key):
            chunks.append(chunk)

        data = json.loads(b"".join(chunks))

        for sequence in data:
            for orf in sequence["orfs"]:
                for hit in orf["hits"]:
                    hmm_ids.add(hit["hit"])

    return hmm_ids


async def get_hmms_referenced_in_db(mongo: Mongo) -> set:
    """Returns a set of all HMM ids referenced in NuVs analysis documents

    :param mongo: the application database object
    :return: set of all HMM ids referenced in analysis documents

    """
    cursor = mongo.analyses.aggregate(
        [
            {"$match": {"workflow": "nuvs"}},
            {"$project": {"results.orfs.hits.hit": True}},
            {"$unwind": "$results"},
            {"$unwind": "$results.orfs"},
            {"$unwind": "$results.orfs.hits"},
            {"$group": {"_id": "$results.orfs.hits.hit"}},
        ],
    )

    return {a["_id"] async for a in cursor}


async def fetch_and_update_release(
    http_client: ClientSession,
    mongo,
    slug: str,
    ignore_errors: bool = False,
) -> Document:
    """Return the HMM install status document or create one if none exists.

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
        # The release dict will only be replaced if there is a 200 response from GitHub.
        # A 304 indicates the release has not changed and `None` is returned from
        # `get_release()`.
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

        logger.info("fetched and updated hmm release")

        return release

    except (
        aiohttp.client_exceptions.ClientConnectorError,
        GitHubError,
    ) as err:
        errors = []

        if "ClientConnectorError" in str(err):
            errors = ["Could not reach GitHub"]

        if "404" in str(err):
            errors = ["GitHub repository or release does not exist"]

        if errors and not ignore_errors:
            raise

        await mongo.status.update_one(
            {"_id": "hmm"},
            {"$set": {"errors": errors, "installed": installed}},
        )

        return release


async def generate_annotations(mongo: Mongo) -> bytes:
    """Generate the HMM annotations as JSON bytes.

    :param mongo: the app mongo client
    :return: the annotations as JSON bytes
    """
    annotations = [base_processor(document) async for document in mongo.hmm.find({})]

    return json.dumps(annotations).encode()
