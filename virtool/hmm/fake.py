import json
from pathlib import Path
from shutil import copy

import aiofiles

from virtool.fake.wrapper import FakerWrapper


async def create_fake_hmms(app):
    fake: FakerWrapper = app["fake"]

    data_path = Path(app["settings"]["data_path"])
    hmms_path = data_path / "hmm"

    example_path = Path(__file__).parent.parent.parent / "example"

    copy(example_path / "hmms/profiles.hmm", hmms_path)

    async with aiofiles.open(example_path / "hmms/annotations.json", "r") as f:
        for annotation in json.loads(await f.read()):
            await app["db"].hmm.insert_one({
                **annotation,
                "_id": fake.get_mongo_id()
            })
    