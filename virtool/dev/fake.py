"""
Code for creating a fake database and application data directory on jobs API startup.

TODO: Add more fake data and files
TODO: Port over to the normal API

"""
from logging import getLogger
from pathlib import Path
from shutil import rmtree
from tempfile import mkdtemp
from virtool.types import App
from virtool.users.fake import create_fake_bob_user
from virtool.utils import ensure_data_dir, random_alphanumeric
from virtool.fake.factory import load_test_case_from_yml

logger = getLogger(__name__)

REF_ID = "reference_1"


async def populate(app: App):
    await create_fake_bob_user(app)
    for yml_file in Path(app["config"]["fake_path"]).iterdir():
        if yml_file.suffix in (".yml", ".yaml"):
            await load_test_case_from_yml(app, yml_file)



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


def create_fake_data_path() -> Path:
    """
    Create a temporary directory to use as a location for data for a fake instance.

    :return: the data path

    """
    data_path = Path(mkdtemp(prefix=f"virtool_fake_{random_alphanumeric()}_"))
    ensure_data_dir(data_path)
    return data_path