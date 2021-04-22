"""
Work with analyses in the database.

"""
import asyncio
import os
from typing import List, Optional, Tuple

import virtool.analyses.files
import virtool.analyses.utils
import virtool.bio
import virtool.db.utils
import virtool.history.db
import virtool.indexes.db
import virtool.jobs.db
import virtool.otus.utils
import virtool.samples.db
import virtool.tasks.pg
import virtool.tasks.task
import virtool.types
import virtool.utils

PROJECTION = (
    "_id",
    "workflow",
    "created_at",
    "index",
    "job",
    "ready",
    "reference",
    "sample",
    "subtractions",
    "updated_at",
    "user"
)

TARGET_FILES = (
    "hmm.tsv",
    "assembly.fa",
    "orfs.fa",
    "unmapped_hosts.fq",
    "unmapped_otus.fq"
)


class BLAST:
    """
    A class for representing a long-lived remote BLAST search.

    """

    def __init__(self, db, settings: dict, analysis_id: str, sequence_index: int, rid: str):
        self.db = db
        self.settings = settings
        self.analysis_id = analysis_id
        self.sequence_index = sequence_index
        self.rid = rid
        self.error = None
        self.interval = 3
        self.ready = False
        self.result = None

    async def remove(self):
        """
        Remove the BLAST result from the analysis document.

        """
        await remove_nuvs_blast(self.db, self.analysis_id, self.sequence_index)

    async def sleep(self):
        """
        Sleep for the current interval and increase the interval by 5 seconds after sleeping.

        """
        await asyncio.sleep(self.interval)
        self.interval += 5

    async def update(
            self,
            ready: bool,
            result: Optional[dict],
            error: Optional[str]
    ) -> Tuple[dict, dict]:
        """
        Update the BLAST data. Returns the BLAST data and the complete analysis document.

        :param ready: indicates whether the BLAST request is complete
        :param result: the formatted result of a successful BLAST request
        :param error: and error message to add to the BLAST record
        :return: the BLAST data and the complete analysis document

        """
        self.result = result

        if ready is None:
            self.ready = await virtool.bio.check_rid(self.settings, self.rid)
        else:
            self.ready = ready

        data = {
            "error": error,
            "interval": self.interval,
            "last_checked_at": virtool.utils.timestamp(),
            "rid": self.rid,
            "ready": ready,
            "result": self.result
        }

        document = await self.db.analyses.find_one_and_update({
            "_id": self.analysis_id,
            "results.index": self.sequence_index
        }, {
            "$set": {
                "results.$.blast": data,
                "updated_at": virtool.utils.timestamp()
            }
        })

        return data, document


async def create(
    db,
    sample_id: str,
    ref_id: str,
    subtractions: List[str],
    user_id: str,
    workflow: str,
    job_id: str,
    analysis_id: Optional[str] = None
) -> dict:
    """
    Creates a new analysis.

    Ensures that a valid subtraction host was the submitted. Configures
    read and write permissions on the sample document and assigns it a creator username based on
    the requesting connection.

    :param db: the application database object
    :param sample_id: the ID of the sample to create an analysis for
    :param ref_id: the ID of the reference to analyze against
    :param subtractions: the list of the subtraction IDs to remove from the analysis
    :param user_id: the ID of the user starting the job
    :param workflow: the analysis workflow to run
    :param job_id: the ID of the job
    :param analysis_id: the ID of the analysis

    :return: the analysis document

    """
    # Get the current id and version of the otu index currently being used for analysis.
    index_id, index_version = await virtool.indexes.db.get_current_id_and_version(db, ref_id)

    analysis_id = analysis_id or await virtool.db.utils.get_new_id(db.analyses)

    created_at = virtool.utils.timestamp()

    document = {
        "_id": analysis_id,
        "ready": False,
        "created_at": created_at,
        "updated_at": created_at,
        "job": {
            "id": job_id
        },
        "files": [],
        "workflow": workflow,
        "sample": {
            "id": sample_id
        },
        "index": {
            "id": index_id,
            "version": index_version
        },
        "reference": {
            "id": ref_id,
            "name": await virtool.db.utils.get_one_field(db.references, "name", ref_id)
        },
        "subtractions": subtractions,
        "user": {
            "id": user_id,
        }
    }

    await db.analyses.insert_one(document)

    return document


async def update_nuvs_blast(
        db,
        settings: dict,
        analysis_id: str,
        sequence_index: int,
        rid: str,
        error: Optional[str] = None,
        interval: int = 3,
        ready: Optional[bool] = None,
        result: Optional[dict] = None
) -> Tuple[dict, dict]:
    """
    Update the BLAST data for a sequence in a NuVs analysis.

    :param db: the application database object
    :param settings: the application settings
    :param analysis_id: the id of the analysis the BLAST is for
    :param sequence_index: the index of the NuVs sequence the BLAST is for
    :param rid: the id of the request
    :param error: an error message if the BLAST failed
    :param interval: the current interval for checking the request status on NCBI
    :param ready: indicates that the BLAST result is ready
    :param result: the formatted result from NCBI
    :return: the blast data and the complete analysis document

    """
    if ready is None:
        ready = await virtool.bio.check_rid(settings, rid)

    data = {
        "interval": interval,
        "last_checked_at": virtool.utils.timestamp(),
        "rid": rid,
        "ready": ready,
        "result": result
    }

    document = await db.analyses.find_one_and_update(
        {"_id": analysis_id, "results.index": sequence_index}, {
            "$set": {
                "results.$.blast": data,
                "updated_at": virtool.utils.timestamp()
            }
        })

    return data, document


async def remove_nuvs_blast(db, analysis_id: str, sequence_index: int):
    """
    Remove the BLAST data for the identified NuVs contig sequence.

    :param db: the application database object
    :param analysis_id: the ID of the analysis containing the sequence
    :param sequence_index: the index of the sequence to remove BLAST data from
    :return:
    """
    await db.analyses.update_one({"_id": analysis_id, "results.index": sequence_index}, {
        "$set": {
            "results.$.blast": None,
            "updated_at": virtool.utils.timestamp()
        }
    })


async def remove_orphaned_directories(app: virtool.types.App):
    """
    Remove all analysis directories for which an analysis document does not exist in the database.

    :param app: the application object

    """
    db = app["db"]

    samples_path = app["settings"]["data_path"] / "samples"

    existing_ids = set(await db.analyses.distinct("_id"))

    for sample_id in os.listdir(samples_path):
        analyses_path = samples_path / sample_id / "analysis"

        to_delete = set(os.listdir(analyses_path)) - existing_ids

        for analysis_id in to_delete:
            analysis_path = analyses_path / analysis_id
            try:
                await app["run_in_thread"](virtool.utils.rm, analysis_path, True)
            except FileNotFoundError:
                pass
