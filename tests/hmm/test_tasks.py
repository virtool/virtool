import json
import tarfile
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from virtool.hmm.tasks import HMMInstallTask
from virtool.tasks.sql import SQLTask
from virtool.utils import get_temp_dir

annotations = [
    {
        "families": {"None": 2, "Geminiviridae": 235},
        "total_entropy": 185.12,
        "length": 356,
        "cluster": 2,
        "entries": [
            {
                "accession": "NP_040324.1",
                "gi": 9626083,
                "organism": "Pepper huasteco yellow vein virus",
                "name": "AL1 protein",
            },
        ],
    }
]


async def test_hmm_install_task(
    data_layer, tmp_path, pg, mongo, static_time, mocker, snapshot
):
    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="install_hmms",
                type="install_hmms",
                created_at=static_time.datetime,
            )
        )
        await session.commit()

    (tmp_path / "hmm").mkdir(parents=True)

    temp_dir = get_temp_dir()

    compress_dir = tmp_path / "comp"
    compress_dir.mkdir(parents=True)
    compress_dir.joinpath("annotations.json").write_text(json.dumps(annotations))
    compress_dir.joinpath("profiles.hmm").write_text("test_profile")

    with tarfile.open(Path(temp_dir.name) / "hmm.tar.gz", mode="w:gz") as archive_file:
        archive_file.add(compress_dir, arcname="hmm")

    mocker.patch("virtool.hmm.tasks.download_file")

    task = HMMInstallTask(
        1,
        data_layer,
        {
            "user_id": "foo",
            "release": {"size": 10, "download_url": "https://virtool.ca", "id": "1"},
        },
        temp_dir,
    )

    await task.run()

    assert await mongo.hmm.find().to_list(1) == snapshot(name="mongo_hmms")
    assert await data_layer.tasks.get(1) == snapshot(name="data_layer_task")
    assert {p.name for p in (tmp_path / "hmm").iterdir()} == {"profiles.hmm"}
