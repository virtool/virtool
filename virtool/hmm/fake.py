import json
from shutil import copy

import aiofiles

from virtool.example.paths import example_path
from virtool.fake.wrapper import FakerWrapper
from virtool.types import App


async def create_fake_hmms(app: App):
    fake: FakerWrapper = app["fake"]

    data_path = app["settings"]["data_path"]
    hmms_path = data_path / "hmm"

    copy(example_path / "hmms/profiles.hmm", hmms_path)

    async with aiofiles.open(example_path / "hmms/annotations.json", "r") as f:
        for annotation in json.loads(await f.read()):
            await app["db"].hmm.insert_one({
                **annotation,
                "_id": fake.get_mongo_id()
            })
