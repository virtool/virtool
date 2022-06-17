from typing import List, Union

from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r404
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.http.routes
from virtool.api.response import EmptyRequest, NotFound, json_response
from virtool.mongo.transforms import apply_transforms
from virtool.labels.db import SampleCountTransform
from virtool.labels.models import Label as LabelSQL
from virtool.pg.utils import get_generic
from virtool.labels.oas import CreateLabelSchema, EditLabelSchema
from virtool_core.models.label import Label, LabelMinimal
routes = virtool.http.routes.Routes()


@routes.view("/labels")
class LabelsView(PydanticView):

    async def get(self) -> Union[r200[List[LabelMinimal]], r400]:
        """
        List all sample labels.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        term = self.request.query.get("find")

        statement = select(LabelSQL).order_by(LabelSQL.name)
        if term:
            statement = statement.filter(LabelSQL.name.ilike(f"%{term}%"))

        labels = await get_generic(self.request.app["pg"], statement)

        documents = await apply_transforms(
            [label.to_dict() for label in labels], [SampleCountTransform(self.request.app["db"])]
        )

        return json_response(documents)

    async def post(self, data: CreateLabelSchema) -> Union[r201[Label], r400]:
        """
        Create a sample label.

        The color must be a valid hexadecimal code.

        Status Codes:
            201: Successful operation
            400: Invalid Input
        """
        name = data.name
        color = data.color
        description = data.description

        async with AsyncSession(self.request.app["pg"]) as session:
            label = LabelSQL(
                name=name, color=color, description=description
            )

            session.add(label)

            try:
                await session.flush()
                document = label.to_dict()
                await session.commit()
            except IntegrityError:
                raise HTTPBadRequest(text="Label name already exists")

        document = await apply_transforms(document, [SampleCountTransform(self.request.app["db"])])

        headers = {"Location": f"/labels/{document['id']}"}

        return json_response(document, status=201, headers=headers)


@routes.view("/labels/{label_id}")
class LabelView(PydanticView):

    async def get(self) -> Union[r200[Label], r404]:
        """
        Get the details for a sample label.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        async with AsyncSession(self.request.app["pg"]) as session:
            result = await session.execute(
                select(LabelSQL).filter_by(id=int(self.request.match_info["label_id"]))
            )

            label = result.scalar()

        if label is None:
            raise NotFound()

        document = await apply_transforms(
            label.to_dict(), [SampleCountTransform(self.request.app["db"])]
        )

        return json_response(document)

    async def patch(self, data: EditLabelSchema) -> Union[r200[Label], r400, r404]:
        """
        Edit an existing sample label.

        Status codes:
            200: Successful operation
            400: Invalid input
            404: Not found
        """
        label_id = int(self.request.match_info["label_id"])

        if not data:
            raise EmptyRequest()

        async with AsyncSession(self.request.app["pg"]) as session:
            result = await session.execute(select(LabelSQL).filter_by(id=label_id))
            label = result.scalar()

            if label is None:
                raise NotFound()

            label.name = data.name
            label.color = data.color
            label.description = data.description
            document = label.to_dict()
            try:
                await session.commit()
            except IntegrityError:
                raise HTTPBadRequest(text="Label name already exists")

        document = await apply_transforms(document, [SampleCountTransform(self.request.app["db"])])

        return json_response(document)

    async def delete(self) -> Union[r204, r404]:
        """
        Delete a sample label.

        Status Codes:
            204: Successful operation
            404: Not found
        """
        label_id = int(self.request.match_info["label_id"])

        async with AsyncSession(self.request.app["pg"]) as session:
            result = await session.execute(select(LabelSQL).filter_by(id=label_id))
            label = result.scalar()

            if label is None:
                raise NotFound()

            await session.delete(label)
            await session.commit()

        raise HTTPNoContent
