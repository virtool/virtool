from pathlib import Path
from typing import List

from virtool.fake.identifiers import USER_ID
from virtool.fake.wrapper import FakerWrapper
from virtool.samples.db import create_sample, finalize
from virtool.samples.files import create_reads_file
from virtool.types import App

EXAMPLE_FILES_PATH = Path(__file__).parent.parent.parent / "example"
READ_FILES_PATH = EXAMPLE_FILES_PATH / "reads"


async def create_fake_samples(app: App) -> List[dict]:
    samples = []
    fake = app["fake"]

    samples.append(await create_fake_sample(app, fake.get_mongo_id(), USER_ID, paired=True, finalized=True))
    samples.append(await create_fake_sample(app, fake.get_mongo_id(), USER_ID, paired=False, finalized=True))
    samples.append(await create_fake_sample(app, fake.get_mongo_id(), USER_ID, finalized=False))

    return samples


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


async def create_fake_quality(fake: FakerWrapper) -> dict:
    return {
        "count":
        fake.integer(min_value=10000, max_value=10000000000),
        "encoding":
        "Sanger / Illumina 1.9\n",
        "length": [
            fake.integer(10, 100),
            fake.integer(10, 100),
        ],
        "gc":
        fake.integer(0, 100),
        "bases": [[fake.integer(31, 32) for _ in range(5)] for _ in range(5)],
        "sequences":
        fake.list(25, value_types=[int]),
        "composition": [
            list(create_fake_composition(fake))
            for _ in range(fake.integer(4, 8))
        ],
        "hold":
        fake.boolean(),
        "group_read":
        fake.boolean(),
        "group_write":
        fake.boolean(),
        "all_read":
        fake.boolean(),
        "all_write":
        fake.boolean(),
        "paired":
        fake.boolean(),
    }


async def create_fake_sample(app: App, sample_id: str, user_id: str, paired=False, finalized=False) -> dict:
    fake = app["fake"]
    db = app["db"]
    pg = app["pg"]

    subtraction_ids = [doc["_id"] async for doc in db.subtraction.find()]

    if finalized is True:
        if paired:
            for n in (1, 2):
                file_path = READ_FILES_PATH / f"paired_{n}.fq.gz"
                await create_reads_file(
                    pg,
                    file_path.stat().st_size,
                    f"reads_{n}.fq.gz",
                    f"reads_{n}.fq.gz",
                    sample_id,
                )
        else:
            file_path = READ_FILES_PATH / "single.fq.gz"
            await create_reads_file(
                pg,
                file_path.stat().st_size,
                "reads_1.fq.gz",
                "reads_1.fq.gz",
                sample_id,
            )

    sample = await create_sample(
        _id=sample_id,
        db=db,
        name=" ".join(fake.words(2)),
        host="Vine",
        isolate="Isolate A1",
        locale="",
        subtractions=subtraction_ids,
        notes=fake.text(50),
        library_type="normal",
        labels=[],
        user_id=user_id,
        group=fake.words(1)[0],
        settings={
            "app": app,
            "db": db,
            "sample_group_read": True,
            "sample_group_write": True,
            "sample_all_read": True,
            "sample_all_write": True,
        },
    )

    if finalized is True:
        sample = await finalize(
            db=db,
            pg=pg,
            sample_id=sample_id,
            quality=await create_fake_quality(fake),
            run_in_thread=app["run_in_thread"],
            data_path=app["settings"]["data_path"],
        )

    return sample
