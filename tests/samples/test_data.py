import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.enums import LibraryType
from virtool_core.models.samples import WorkflowState

from virtool.fake.next import DataFaker
from virtool.samples.models import SQLSampleArtifact, SQLSampleReads


@pytest.fixture
async def get_sample_data(
    mongo: "Mongo", fake2: DataFaker, pg: AsyncEngine, static_time
):
    label = await fake2.labels.create()
    await fake2.labels.create()

    user = await fake2.users.create()

    await asyncio.gather(
        mongo.subtraction.insert_many(
            [
                {"_id": "apple", "name": "Apple"},
                {"_id": "pear", "name": "Pear"},
                {"_id": "peach", "name": "Peach"},
            ],
            session=None,
        ),
        mongo.samples.insert_one(
            {
                "_id": "test",
                "all_read": True,
                "all_write": True,
                "created_at": static_time.datetime,
                "files": [
                    {
                        "id": "foo",
                        "name": "Bar.fq.gz",
                        "download_url": "/download/samples/files/file_1.fq.gz",
                    }
                ],
                "format": "fastq",
                "group": "none",
                "group_read": True,
                "group_write": True,
                "hold": False,
                "host": "",
                "is_legacy": False,
                "isolate": "",
                "labels": [label.id],
                "library_type": LibraryType.normal.value,
                "locale": "",
                "name": "Test",
                "notes": "",
                "nuvs": False,
                "pathoscope": True,
                "ready": True,
                "subtractions": ["apple", "pear"],
                "user": {"id": user.id},
                "workflows": {
                    "aodp": WorkflowState.INCOMPATIBLE.value,
                    "pathoscope": WorkflowState.COMPLETE.value,
                    "nuvs": WorkflowState.PENDING.value,
                },
            }
        ),
    )

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLSampleArtifact(
                    name="reference.fa.gz",
                    sample="test",
                    type="fasta",
                    name_on_disk="reference.fa.gz",
                ),
                SQLSampleReads(
                    name="reads_1.fq.gz",
                    name_on_disk="reads_1.fq.gz",
                    sample="test",
                    size=2903109210,
                    uploaded_at=static_time.datetime,
                    upload=None,
                ),
            ]
        )
        await session.commit()

    return user.id
