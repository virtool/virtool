"""Work with HMM data in the database."""

import json

from aiohttp import ClientConnectorError, ClientSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.utils
from virtool.hmm.releases import (
    GetReleaseError,
    ReleaseType,
    fetch_release_manifest_from_virtool,
)
from virtool.hmm.sql import HMM_STATUS_ID, SQLHMM, SQLHMMStatus
from virtool.hmm.utils import format_hmm_release
from virtool.types import Document

logger = get_logger("hmms")

HMMS_REFRESH_INTERVAL = 600
"""How frequently the HMMs should be refreshed from the www.virtool.ca manifest.

There is currently only one version of HMM data and refreshes after the initial install
of the data do nothing.
"""


async def fetch_and_update_release(
    http_client: ClientSession,
    pg: AsyncEngine,
    ignore_errors: bool = False,
) -> Document:
    """Return the HMM install status release or create the status row if absent.

    The status is written to the Postgres ``legacy_hmm_status`` singleton.

    :param http_client: the application http client
    :param pg: the application Postgres client
    :param ignore_errors: ignore possible errors when fetching the manifest
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

    # The currently installed release.
    installed = status.installed if status else None

    if installed is True:
        installed = status.updates[0]

    try:
        manifest = await fetch_release_manifest_from_virtool(
            http_client,
            ReleaseType.HMMS,
        )

        # The newest release is the first item in the manifest list. Treat a
        # missing key or empty list as "no update" and keep the stored release.
        releases = manifest.get("virtool-hmm") if manifest else None
        updated = releases[0] if releases else None
    except (ClientConnectorError, GetReleaseError) as err:
        errors = []

        if "ClientConnectorError" in str(err):
            errors = ["Could not reach Virtool.ca"]

        if "404" in str(err):
            errors = ["Release does not exist"]

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

    # Release is replaced with the updated release if a newer one was found.
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

    The integer primary key is exposed as ``id``; annotations are addressed by
    their Postgres id rather than the legacy Mongo string.
    """
    return {
        "id": row.id,
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
