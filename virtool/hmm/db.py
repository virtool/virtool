"""Work with HMM data in the database."""

import json

import aiohttp.client_exceptions
from aiohttp import ClientSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.utils
from virtool.errors import GitHubError
from virtool.github import get_etag, get_release
from virtool.hmm.sql import HMM_STATUS_ID, SQLHMM, SQLHMMStatus
from virtool.hmm.utils import format_hmm_release
from virtool.types import Document

logger = get_logger("hmms")

HMM_REPO_SLUG = "virtool/virtool-hmm"
"""The GitHub slug for the canonical HMM data repository."""

HMMS_REFRESH_INTERVAL = 600
"""How frequently the HMMs should be refreshed from the GitHub repository.

There is currently only one version of HMM data and refreshes after the initial install
of the data do nothing.
"""


async def fetch_and_update_release(
    http_client: ClientSession,
    pg: AsyncEngine,
    slug: str,
    ignore_errors: bool = False,
) -> Document:
    """Return the HMM install status release or create the status row if absent.

    The status is written to the Postgres ``legacy_hmm_status`` singleton.

    :param http_client: the application http client
    :param pg: the application Postgres client
    :param slug: the slug for the HMM GitHub repo
    :param ignore_errors: ignore possible errors when making GitHub request
    :return: the release

    """
    async with AsyncSession(pg) as session:
        status = (
            await session.execute(
                select(SQLHMMStatus).where(SQLHMMStatus.id == HMM_STATUS_ID),
            )
        ).scalar_one_or_none()

    # The latest release stored in the HMM status row.
    release = status.release if status else None

    # The ETag for the latest stored release.
    etag = get_etag(release)

    # The currently installed release.
    installed = status.installed if status else None

    if installed is True:
        installed = status.updates[0]

    try:
        # The release dict will only be replaced if there is a 200 response from GitHub.
        # A 304 indicates the release has not changed and `None` is returned from
        # `get_release()`.
        updated = await get_release(http_client, slug, etag)
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

        async with AsyncSession(pg) as session:
            await session.execute(
                insert(SQLHMMStatus)
                .values(
                    id=HMM_STATUS_ID,
                    errors=errors,
                    installed=installed,
                    release=release,
                )
                .on_conflict_do_update(
                    index_elements=[SQLHMMStatus.id],
                    set_={"errors": errors, "installed": installed},
                ),
            )
            await session.commit()

        return release

    # Release is replaced with updated release if an update was found on GitHub.
    if updated:
        release = format_hmm_release(updated, release, installed)

    release["retrieved_at"] = virtool.utils.timestamp()

    # Set an empty error list since the update check was successful.
    async with AsyncSession(pg) as session:
        await session.execute(
            insert(SQLHMMStatus)
            .values(id=HMM_STATUS_ID, errors=[], installed=installed, release=release)
            .on_conflict_do_update(
                index_elements=[SQLHMMStatus.id],
                set_={"errors": [], "installed": installed, "release": release},
            ),
        )
        await session.commit()

    logger.info("fetched and updated hmm release")

    return release


def annotation_from_row(row: SQLHMM) -> Document:
    """Reconstruct the stored HMM annotation document from a Postgres row.

    The Mongo ``_id`` is exposed as ``id`` so the output matches the document
    shape that was previously generated from Mongo.
    """
    return {
        "id": row.legacy_id,
        "cluster": row.cluster,
        "count": row.count,
        "length": row.length,
        "mean_entropy": row.mean_entropy,
        "total_entropy": row.total_entropy,
        "hidden": row.hidden,
        "names": row.names,
        "families": row.families,
        "genera": row.genera,
        "entries": row.entries,
    }


async def generate_annotations(pg: AsyncEngine) -> bytes:
    """Generate the HMM annotations as JSON bytes.

    :param pg: the application Postgres client
    :return: the annotations as JSON bytes
    """
    async with AsyncSession(pg) as session:
        rows = (
            (await session.execute(select(SQLHMM).order_by(SQLHMM.id))).scalars().all()
        )

    annotations = [annotation_from_row(row) for row in rows]

    return json.dumps(annotations).encode()
