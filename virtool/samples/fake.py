import shutil
from asyncio import to_thread
from pathlib import Path
from typing import Optional

from virtool_core.models.settings import Settings

from virtool.config import get_config_from_app
from virtool.data.utils import get_data_from_app
from virtool.example import example_path
from virtool.fake.wrapper import FakerWrapper
from virtool.mongo.utils import get_mongo_from_app
from virtool.samples.db import create_sample
from virtool.samples.files import create_reads_file
from virtool.types import App

READ_FILES_PATH = example_path / "reads"

SAMPLE_ID_UNPAIRED = "sample_unpaired"
SAMPLE_ID_PAIRED = "sample_paired"
SAMPLE_ID_UNPAIRED_FINALIZED = "sample_unpaired_finalized"
SAMPLE_ID_PAIRED_FINALIZED = "sample_paired_finalized"


def create_fake_composition(fake: FakerWrapper):
    left = 100
    sent = 0

    while left > 0 and sent < 4:
        i = fake.integer(1, 97)
        yield i
        sent += 1
        left -= i

    while sent < 4:
        yield 1
        sent += 1


async def create_fake_quality(fake: Optional[FakerWrapper]) -> dict:
    if fake is None:
        fake = FakerWrapper()

    return {
        "count": fake.integer(min_value=10000, max_value=10000000000),
        "encoding": "Sanger / Illumina 1.9\n",
        "length": [
            fake.integer(10, 100),
            fake.integer(10, 100),
        ],
        "gc": fake.integer(0, 100),
        "bases": [[fake.integer(31, 32) for _ in range(5)] for _ in range(5)],
        "sequences": fake.list(25, value_types=[int]),
        "composition": [
            list(create_fake_composition(fake)) for _ in range(fake.integer(4, 8))
        ],
        "hold": fake.boolean(),
        "group_read": fake.boolean(),
        "group_write": fake.boolean(),
        "all_read": fake.boolean(),
        "all_write": fake.boolean(),
        "paired": fake.boolean(),
    }


async def create_fake_sample(
    app: App,
    sample_id: str,
    user_id: str,
    paired: bool = False,
    finalized: bool = False,
):
    fake = app.get("fake", FakerWrapper())

    mongo = get_mongo_from_app(app)
    pg = app["pg"]

    subtraction_ids = [doc["_id"] async for doc in mongo.subtraction.find()][:2]

    if finalized is True:
        if paired:
            for n in (1, 2):
                file_path = READ_FILES_PATH / f"paired_{n}.fq.gz"

                await copy_reads_file(app, file_path, f"reads_{n}.fq.gz", sample_id)

                await create_reads_file(
                    pg,
                    file_path.stat().st_size,
                    f"reads_{n}.fq.gz",
                    f"reads_{n}.fq.gz",
                    sample_id,
                )
        else:
            file_path = READ_FILES_PATH / "single.fq.gz"

            await copy_reads_file(app, file_path, "reads_1.fq.gz", sample_id)

            await create_reads_file(
                pg,
                file_path.stat().st_size,
                "reads_1.fq.gz",
                "reads_1.fq.gz",
                sample_id,
            )

    settings = Settings()
    settings.sample_group_read = True
    settings.sample_group_write = True
    settings.sample_all_read = True
    settings.sample_all_write = True

    await create_sample(
        _id=sample_id,
        mongo=mongo,
        name=f"Fake {sample_id.upper()}",
        host="Vine",
        isolate="Isolate A1",
        locale="",
        subtractions=subtraction_ids,
        notes=fake.text(50),
        library_type="normal",
        labels=[],
        user_id=user_id,
        group="none",
        settings=settings,
    )

    if finalized is True:
        await get_data_from_app(app).samples.finalize(
            sample_id=sample_id,
            quality=await create_fake_quality(fake),
        )


async def copy_reads_file(app: App, file_path: Path, filename: str, sample_id: str):
    """Copy the example reads file to the sample directory.

    :param app: the application object
    :param file_path: the path to the reads file
    :param filename: the name of the file
    :param sample_id: the id of the sample

    """
    reads_path = get_config_from_app(app).data_path / "samples" / sample_id
    reads_path.mkdir(parents=True, exist_ok=True)

    await to_thread(shutil.copy, file_path, reads_path / filename)
