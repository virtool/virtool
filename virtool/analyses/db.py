"""
Work with analyses in the database.

Schema:
- _id (str) the ID for the analysis
- cache (Object) describes the cache associated with the sample
  - id (str) the ID of the cache
- created_at (datetime) when the analyses document was first created
- index (Object) describes the index analyzed against
  - id (str) the index ID
- job (Object) describes the workflow job
  - id (str) the job ID
- read_count (int)
  - the number of reads involved in the analysis
- ready (bool) true when the analysis workflow has completed
- reference (Object) described the reference analyzed against
  - id (str) the ID of the reference
- results (JSON) the result payload of the workflow
- sample (Object) describes the sample analyzed
  - id (str) the sample ID
- subtracted_count (int) number of reads subtracted (should be in results)
- subtraction (Object) describes the subtraction
  - id (str) the subtraction ID
- updated_at (datetime) when the analysis was last modified - used for browser caching
- user (Object) describes the creating user
  - id (str) the user ID
- workflow (Enum["aodp", "nuvs", "pathoscope") the workflow

"""
import asyncio
import os
from typing import Tuple, Optional

import virtool.analyses.utils
import virtool.bio
import virtool.db.utils
import virtool.history.db
import virtool.indexes.db
import virtool.jobs.db
import virtool.otus.utils
import virtool.samples.db
import virtool.types
import virtool.utils

PROJECTION = [
    "_id",
    "workflow",
    "created_at",
    "index",
    "job",
    "ready",
    "reference",
    "sample",
    "subtraction",
    "updated_at",
    "user"
]


class BLAST:

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

    async def update(self, ready: bool, result: Optional[dict], error: Optional[str]) -> Tuple[dict, dict]:
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


async def create(app: virtool.types.App, sample_id: str, ref_id: str, subtraction_id: str, user_id: str, workflow: str) -> dict:
    """
    Creates a new analysis. Ensures that a valid subtraction host was the submitted. Configures read and write
    permissions on the sample document and assigns it a creator username based on the requesting connection.

    :param app: the application object
    :param sample_id: the ID of the sample to create an analysis for
    :param ref_id: the ID of the reference to analyze against
    :param subtraction_id: the ID of the subtraction to remove from the analysis
    :param user_id: the ID of the user starting the job
    :param workflow: the analysis workflow to run
    :return: the analysis document

    """
    db = app["db"]
    settings = app["settings"]

    # Get the current id and version of the otu index currently being used for analysis.
    index_id, index_version = await virtool.indexes.db.get_current_id_and_version(db, ref_id)

    sample = await db.samples.find_one(sample_id, ["name"])

    analysis_id = await virtool.db.utils.get_new_id(db.analyses)

    job_id = await virtool.db.utils.get_new_id(db.jobs)

    created_at = virtool.utils.timestamp()

    document = {
        "_id": analysis_id,
        "ready": False,
        "created_at": created_at,
        "updated_at": created_at,
        "job": {
            "id": job_id
        },
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
        "subtraction": {
            "id": subtraction_id
        },
        "user": {
            "id": user_id,
        }
    }

    task_args = {
        "analysis_id": analysis_id,
        "ref_id": ref_id,
        "sample_id": sample_id,
        "sample_name": sample["name"],
        "index_id": index_id
    }

    await db.analyses.insert_one(document)

    # Create job document.
    job = await virtool.jobs.db.create(
        db,
        document["workflow"],
        task_args,
        user_id
    )

    await app["jobs"].enqueue(job["_id"])

    await virtool.samples.db.recalculate_workflow_tags(db, sample_id)

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

    document = await db.analyses.find_one_and_update({"_id": analysis_id, "results.index": sequence_index}, {
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

    samples_path = os.path.join(app["settings"]["data_path"], "samples")

    existing_ids = set(await db.analyses.distinct("_id"))

    for sample_id in os.listdir(samples_path):
        analyses_path = os.path.join(samples_path, sample_id, "analysis")

        to_delete = set(os.listdir(analyses_path)) - existing_ids

        for analysis_id in to_delete:
            analysis_path = os.path.join(analyses_path, analysis_id)
            try:
                await app["run_in_thread"](virtool.utils.rm, analysis_path, True)
            except FileNotFoundError:
                pass
