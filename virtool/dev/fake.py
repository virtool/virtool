"""
Code for creating a fake database and application data directory on jobs API startup.

TODO: Add more fake data and files
TODO: Port over to the normal API

"""
from logging import getLogger
from shutil import rmtree
from tempfile import mkdtemp

import virtool.analyses.db
import virtool.analyses.files
import virtool.jobs.db
import virtool.references.db
import virtool.subtractions.db
import virtool.users.db
import virtool.utils
from virtool.fake.identifiers import USER_ID
from virtool.hmm.fake import create_fake_hmms
from virtool.indexes.fake import create_fake_indexes
from virtool.jobs.utils import JobRights
from virtool.otus.fake import create_fake_otus
from virtool.subtractions.fake import create_fake_subtractions
from virtool.types import App
from virtool.users.fake import create_fake_bob_user
from virtool.utils import ensure_data_dir, random_alphanumeric

logger = getLogger(__name__)

REF_ID = "reference_1"


async def populate(app: App):
    await create_fake_bob_user(app)
    await create_fake_subtractions(app)
    await create_fake_analysis(app)
    await create_fake_jobs(app)
    await create_fake_hmms(app)
    await create_fake_references(app)
    await create_fake_otus(app, REF_ID, USER_ID)
    await create_fake_indexes(app, REF_ID, USER_ID)


async def remove_fake_data_path(app: App):
    """
    Remove the temporary fake application data directory created when the jobs API is run with the
    ``--fake`` option.

    :param app: the application object

    """
    data_path = app["config"].get("data_path")

    # Be extra sure this is a fake application directory we should remove.
    if data_path and app["config"]["fake"] and "virtool_fake_" in data_path:
        rmtree(data_path)
        logger.debug(f"Removed fake data directory: {data_path}")


async def drop_fake_mongo(app: App):
    """
    Drop a fake Mongo database if the instance was run with the ``--fake`` option.

    :param app: the application object

    """
    db_name = app["config"]["db_name"]

    # Be extra sure this is a fake database we should drop.
    if "fake-" in db_name and app["config"]["fake"]:
        await app["db"].motor_client.client.drop_database(db_name)
        logger.debug(f"Dropped fake Mongo database: {db_name}")


def create_fake_data_path() -> str:
    """
    Create a temporary directory to use as a location for data for a fake instance.

    :return: the data path

    """
    data_path = str(mkdtemp(prefix=f"virtool_fake_{random_alphanumeric()}_"))
    ensure_data_dir(data_path)
    return data_path


async def create_fake_analysis(app: App):
    """
    Create fake analyses in the database.

    Two analyses are ready for use. One has ``ready`` set to ``False`` and
    another one has ``ready`` set to ``True`` with a ``files`` field.

    :param app: the application object

    """
    sample_id = "sample_1"
    ref_id = "reference_1"
    subtractions = [
        "subtraction_1",
        "subtraction_2",
    ]

    file = await virtool.analyses.files.create_analysis_file(
        app["pg"],
        "analysis_2",
        "fasta",
        "result.fa",
        123456
    )

    await app["db"].analyses.insert_many([
        {
            "_id": "analysis_1",
            "workflow": "pathoscope",
            "created_at": virtool.utils.timestamp(),
            "ready": False,
            "job": {
                "id": "job_1"
            },
            "index": {
                "version": 2,
                "id": "foo"
            },
            "user": {
                "id": USER_ID
            },
            "sample": {
                "id": sample_id
            },
            "reference": {
                "id": ref_id
            },
            "subtractions": subtractions
        },
        {
            "_id": "analysis_2",
            "workflow": "pathoscope",
            "created_at": virtool.utils.timestamp(),
            "ready": True,
            "job": {
                "id": "job_2"
            },
            "index": {
                "version": 2,
                "id": "foo"
            },
            "user": {
                "id": USER_ID
            },
            "sample": {
                "id": sample_id
            },
            "reference": {
                "id": ref_id
            },
            "subtractions": subtractions,
            "files": [file]
        }
    ])

    logger.debug("Created fake analyses")


async def create_integration_test_job(app: App):
    name = "integration_test_workflow"
    rights = JobRights()

    return await virtool.jobs.db.create(
        db=app["db"],
        workflow_name=name,
        job_args={
            "sample_id": "sample_1",
            "subtraction_id": "subtraction_1",
            "ref_id": "reference_1",
        },
        user_id=USER_ID,
        rights=rights,
        job_id="integration_test_job",
    )


async def create_fake_jobs(app: App):
    await create_integration_test_job(app)


async def create_fake_references(app: App):
    """
    Create a fake reference with ``genome`` data type.

    :param app: the application object
    """
    reference_1 = await virtool.references.db.create_document(
        app["db"],
        app["settings"],
        "Reference 1",
        "virus",
        "A fake reference",
        "genome",
        ref_id=REF_ID,
        user_id=USER_ID
    )

    reference_2 = await virtool.references.db.create_document(
        app["db"],
        app["settings"],
        "Reference 2",
        "virus",
        "A fake reference",
        "genome",
        ref_id="reference_2",
        user_id=USER_ID
    )

    await app["db"].references.insert_many([reference_1, reference_2])
    logger.debug("Created fake reference")
