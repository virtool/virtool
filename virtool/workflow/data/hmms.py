"""A class and fixture for accessing Virtool HMM data for use in analysis workflows."""

import asyncio
import json
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path

from pyfixtures import fixture
from structlog import get_logger

from virtool.hmm.models import HMM
from virtool.utils import decompress_file
from virtool.workflow.api.client import APIClient

logger = get_logger("api")


@dataclass
class WFHMMs:
    """Hidden Markov model data from Virtool.

    Exposes:

    1. A :class:`dict` the links `HMMER <http://hmmer.org/>`_ cluster IDs to Virtool
       annotation IDs.
    2. The path to the HMM profiles file.

    """

    annotations: list[HMM]
    """All annotations in the HMM dataset."""

    path: Path
    """
    The path to the ``profiles.hmm`` file in the ``work_path`` of the running
    workflow.
    """

    @cached_property
    def cluster_annotation_map(self) -> dict[int, str]:
        """A dict that maps cluster IDs to annotation IDs.

        This is used to link HMMs in `HMMER <http://hmmer.org/>`_ to annotations
        records used in Virtool.
        """
        return {hmm.cluster: hmm.id for hmm in self.annotations}

    @property
    def profiles_path(self) -> Path:
        """The path to the ``profiles.hmm`` file.

        It can be provided directly to HMMER.
        """
        return self.path / "profiles.hmm"

    def get_id_by_cluster(self, cluster: int) -> str:
        """Get the Virtool HMM annotation ID for a given cluster ID.

        :param cluster: a cluster ID
        :return: the corresponding annotation ID
        """
        return self.cluster_annotation_map[cluster]


@fixture
async def hmms(
    _api: APIClient,
    proc: int,
    work_path: Path,
) -> WFHMMs:
    """A fixture for accessing HMM data.

    The ``*.hmm`` file is copied from the data directory and ``hmmpress`` is run to
    create all the HMM files.

    Returns an :class:`.HMMs` object containing the path to the HMM profile file and a
    `dict` that maps HMM cluster numbers to database IDs.

    :raises: :class:`RuntimeError`: hmmpress is not installed
    :raises: :class:`RuntimeError`: hmmpress command failed

    """
    hmms_path = work_path / "hmms"
    await asyncio.to_thread(hmms_path.mkdir, parents=True, exist_ok=True)

    logger.info("downloading hmm annotations")
    annotations_path = hmms_path / "annotations.json"
    compressed_annotations_path = hmms_path / "annotations.json.gz"
    await _api.get_file("/hmms/files/annotations.json.gz", compressed_annotations_path)

    logger.info("unpacking hmm annotations")
    await asyncio.to_thread(
        decompress_file,
        compressed_annotations_path,
        annotations_path,
        proc,
    )

    logger.info("parsing hmm annotations")
    annotations = await asyncio.to_thread(
        lambda: [HMM(**hmm) for hmm in json.loads(annotations_path.read_text())],
    )

    logger.info("downloading hmm profiles")
    profiles_path = hmms_path / "profiles.hmm"
    await _api.get_file("/hmms/files/profiles.hmm", profiles_path)

    logger.info("finished setuping up hmms")
    return WFHMMs(annotations, hmms_path)
