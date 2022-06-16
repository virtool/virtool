from typing import Optional

from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.mongo.utils
import virtool.utils
from virtool_core.models.subtraction import Subtraction

from virtool.data.errors import ResourceNotFoundError
from virtool.mongo.transforms import apply_transforms
from virtool.subtractions.db import attach_computed
from virtool.uploads.db import AttachUploadTransform
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor


class SubtractionsData:
    def __init__(self, base_url: str, mongo, pg: AsyncEngine):
        self._base_url = base_url
        self._mongo = mongo
        self._pg = pg

    async def create(
        self,
        name: str,
        nickname: str,
        upload_id: int,
        user_id: str,
        subtraction_id: Optional[str] = None,
    ) -> Subtraction:
        """
        Create a new subtraction.

        :param user_id: the id of the current user
        :param upload_id: the id of the uploaded FASTA file
        :param name: the name of the subtraction
        :param nickname: the nickname of the subtraction
        :param upload_id: the id of the `subtraction_file`
        :param subtraction_id: the id of the subtraction
        :return: the subtraction

        """
        document = {
            "_id": subtraction_id
            or await virtool.mongo.utils.get_new_id(self._mongo.subtraction),
            "name": name,
            "nickname": nickname,
            "deleted": False,
            "ready": False,
            "upload": upload_id,
            "user": {"id": user_id},
            "created_at": virtool.utils.timestamp(),
        }

        await self._mongo.subtraction.insert_one(document)

        document = await attach_computed(
            self._mongo, self._pg, self._base_url, document
        )

        document = await apply_transforms(
            base_processor(document),
            [
                AttachUserTransform(self._mongo, ignore_errors=True),
                AttachUploadTransform(self._pg),
            ],
        )

        return Subtraction(**document)

    async def get(self, subtraction_id: str) -> Subtraction:
        document = await self._mongo.subtraction.find_one(subtraction_id)

        if document:
            document = await attach_computed(
                self._mongo,
                self._pg,
                self._base_url,
                document,
            )

            document = await apply_transforms(
                base_processor(document),
                [AttachUserTransform(self._mongo, ignore_errors=True)],
            )

            return Subtraction(**base_processor(document))

        raise ResourceNotFoundError
