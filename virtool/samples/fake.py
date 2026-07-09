from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.utils
from virtool.data.utils import get_data_from_app
from virtool.example import example_path
from virtool.fake.wrapper import FakerWrapper
from virtool.samples.files import create_reads_file
from virtool.samples.sql import SQLLegacySample, SQLLegacySampleSubtraction
from virtool.samples.utils import sample_file_key, sample_storage_id
from virtool.storage.protocol import STORAGE_CHUNK_SIZE, StorageBackend
from virtool.subtractions.pg import SQLSubtraction
from virtool.types import App

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


async def create_fake_quality(fake: FakerWrapper | None) -> dict:
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
    user_id: int,
    paired: bool = False,
    finalized: bool = False,
) -> None:
    fake = app.get("fake", FakerWrapper())

    pg = app["pg"]
    storage: StorageBackend = app["storage"]

    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLSubtraction.id).limit(2),
        )

        subtraction_ids = list(result.scalars().all())

        sample = SQLLegacySample(
            legacy_id=sample_id,
            name=f"Fake {sample_id.upper()}",
            host="Vine",
            isolate="Isolate A1",
            locale="",
            notes=fake.text(50),
            library_type="normal",
            format="fastq",
            quality=None,
            created_at=virtool.utils.timestamp(),
            paired=False,
            ready=False,
            hold=True,
            is_legacy=False,
            all_read=True,
            all_write=True,
            group_read=True,
            group_write=True,
            user_id=user_id,
        )
        session.add(sample)
        await session.flush()

        sample_pk = sample.id

        for subtraction_id in subtraction_ids:
            session.add(
                SQLLegacySampleSubtraction(
                    sample_id=sample_pk,
                    subtraction_id=subtraction_id,
                ),
            )

        await session.commit()

    storage_id = sample_storage_id(sample_pk, sample_id)

    if finalized is True:
        if paired:
            for n in (1, 2):
                file_path = example_path / "sample" / f"reads_{n}.fq.gz"

                await copy_reads_file(
                    storage,
                    file_path,
                    f"reads_{n}.fq.gz",
                    storage_id,
                )

                await create_reads_file(
                    pg,
                    file_path.stat().st_size,
                    f"reads_{n}.fq.gz",
                    f"reads_{n}.fq.gz",
                    sample_pk,
                    storage_id,
                )
        else:
            file_path = example_path / "sample" / "reads_1.fq.gz"

            await copy_reads_file(storage, file_path, "reads_1.fq.gz", storage_id)

            await create_reads_file(
                pg,
                file_path.stat().st_size,
                "reads_1.fq.gz",
                "reads_1.fq.gz",
                sample_pk,
                storage_id,
            )

        await get_data_from_app(app).samples.finalize(
            sample_id=sample_id,
            quality=await create_fake_quality(fake),
        )


async def _stream_file(file_path: Path):
    with file_path.open("rb") as f:
        while chunk := f.read(STORAGE_CHUNK_SIZE):
            yield chunk


async def copy_reads_file(
    storage: StorageBackend,
    file_path: Path,
    filename: str,
    storage_id: str,
) -> None:
    key = sample_file_key(storage_id, filename)
    await storage.write(key, _stream_file(file_path))
