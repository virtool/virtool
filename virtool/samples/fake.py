from virtool.fake.identifiers import USER_ID
from virtool.samples.db import create_sample, finalize
from virtool.types import App
from virtool.samples.files import create_reads_file
from sqlalchemy.ext.asyncio import AsyncEngine
from pathlib import Path

EXAMPLE_FILES_PATH = Path(__file__).parent.parent.parent / "example"
READ_FILES_PATH = EXAMPLE_FILES_PATH / "reads"


async def create_fake_samples(app: App):
    await create_fake_sample(app, paired=True)
    await create_fake_sample(app, paired=False)


async def create_fake_read_file(
    pg: AsyncEngine, path: Path, sample_id: str, name: str = None
) -> dict:
    name = name or path.name
    size = path.stat().st_size
    return await create_reads_file(
        pg, name=name, size=size, name_on_disk=path.name, sample_id=sample_id,
    )


async def create_fake_quality() -> dict:
    return {}


async def create_fake_sample(app: App, paired=False, finalized=False):
    fake = app["fake"]
    db = app["db"]
    pg = app["pg"]

    subtraction_ids = [doc["_id"] async for doc in db.subtraction.find()]

    sample_id = fake.get_mongo_id()

    files = []

    if finalized is True:
        if paired:
            files.extend(
                [
                    await create_fake_read_file(
                        pg,
                        READ_FILES_PATH / f"paired_{n}.fq.gz",
                        sample_id,
                        name=f"read_{n}.fq.gz",
                    )
                    for n in (1, 2)
                ]
            )
        else:
            files.append(
                await create_fake_read_file(
                    pg, READ_FILES_PATH / "single.fq.gz", sample_id, name="reads.fq.gz"
                )
            )

    sample = await create_sample(
        _id=sample_id,
        db=db,
        name=" ".join(fake.words(2)),
        host="Vine",
        isolate="Isolate A1",
        locale="",
        subtractions=subtraction_ids,
        files=files,
        notes=fake.text(50),
        library_type="normal",
        labels=[fake.words(1)[0] for _ in range(3)],
        user_id=USER_ID,
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
            quality=await create_fake_quality(),
            run_in_thread=app["run_in_thread"],
            data_path=app["data_path"],
        )

    return sample
