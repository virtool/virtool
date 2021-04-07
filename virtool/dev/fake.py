"""
Code for creating a fake database and application data directory on jobs API startup.

TODO: Add more fake data and files
TODO: Port over to the normal API

"""

from logging import getLogger
from shutil import rmtree
from tempfile import mkdtemp

from sqlalchemy.ext.asyncio import AsyncSession

import virtool.analyses.db
import virtool.jobs.db
import virtool.users.db
from virtool.jobs.utils import JobRights
from virtool.types import App
from virtool.uploads.models import Upload
from virtool.utils import ensure_data_dir, random_alphanumeric

logger = getLogger(__name__)

USER_ID = "bob"


async def populate(app: App):
    await create_fake_user(app)
    await create_fake_subtractions(app)
    await create_fake_jobs(app)


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


async def create_fake_user(app: App):
    """
    Create a fake user called Bob.

    :param app: the application object

    """
    await virtool.users.db.create(app["db"], USER_ID, "hello_world", True)

    await virtool.users.db.edit(app["db"], "bob", administrator=True, force_reset=False)

    logger.debug("Created fake user")


async def create_fake_subtractions(app: App):
    """
    Create fake subtractions and their associated uploads and subtraction files.

    Two subtractions are ready for use. One has ``ready`` set to ``False`` and can be used for
    testing subtraction finalization.

    :param app: the application object

    """
    async with AsyncSession(app["pg"]) as session:
        upload = Upload(name="test.fa.gz", type="subtraction", user=USER_ID)

        session.add(upload)
        await session.flush()

        upload_id = upload.id
        upload_name = upload.name

        await session.commit()

    upload = {"id": upload_id, "name": upload_name}

    await app["db"].subtraction.insert_many(
        [
            {
                "_id": "subtraction_1",
                "name": "Subtraction 1",
                "nickname": "",
                "deleted": False,
                "ready": True,
                "file": upload,
                "user": {"id": USER_ID},
            },
            {
                "_id": "subtraction_2",
                "name": "Subtraction 2",
                "nickname": "",
                "deleted": False,
                "ready": True,
                "file": upload,
                "user": {"id": USER_ID},
            },
            {
                "_id": "subtraction_unready",
                "name": "Subtraction Unready",
                "nickname": "",
                "deleted": False,
                "ready": False,
                "file": upload,
                "user": {"id": USER_ID},
            },
        ]
    )

    logger.debug("Created fake subtractions")


async def analysis(app: App):
    """
    Create a complete fake analysis in the database.

    :param app: the application object

    """
    sample_id = "sample_1"
    ref_id = "reference_1"
    subtractions = [
        "subtraction_1",
        "subtraction_2",
    ]

    await virtool.analyses.db.create(
        app, sample_id, ref_id, subtractions, USER_ID, "pathoscope"
    )


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
