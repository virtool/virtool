from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.http.routes
import virtool.validators
from virtool.api.response import EmptyRequest, NotFound, json_response
from virtool.db.transforms import apply_transforms
from virtool.http.schema import schema
from virtool.labels.db import SampleCountTransform
from virtool.labels.models import Label
from virtool.pg.utils import get_generic

routes = virtool.http.routes.Routes()


@routes.get("/labels")
async def find(req):
    """
    Get a list of all label documents in the database.

    """
    term = req.query.get("find")

    statement = select(Label).order_by(Label.name)
    if term:
        statement = statement.filter(Label.name.ilike(f"%{term}%"))

    labels = await get_generic(req.app["pg"], statement)

    documents = await apply_transforms(
        [label.to_dict() for label in labels], [SampleCountTransform(req.app["db"])]
    )

    return json_response(documents)


@routes.get("/labels/{label_id}")
async def get(req):
    """
    Get a complete label document.

    """
    async with AsyncSession(req.app["pg"]) as session:
        result = await session.execute(
            select(Label).filter_by(id=int(req.match_info["label_id"]))
        )

        label = result.scalar()

    if label is None:
        raise NotFound()

    document = await apply_transforms(
        label.to_dict(), [SampleCountTransform(req.app["db"])]
    )

    return json_response(document)


@routes.post("/labels")
@schema(
    {
        "name": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "required": True,
            "empty": False,
        },
        "color": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "check_with": virtool.validators.is_valid_hex_color,
            "default": "#A0AEC0",
        },
        "description": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "default": "",
        },
    }
)
async def create(req):
    """
    Add a new label to the labels database.
    """
    data = req["data"]

    async with AsyncSession(req.app["pg"]) as session:
        label = Label(
            name=data["name"], color=data["color"], description=data["description"]
        )

        session.add(label)

        try:
            await session.flush()
            document = label.to_dict()
            await session.commit()
        except IntegrityError:
            raise HTTPBadRequest(text="Label name already exists")

    document = await apply_transforms(document, [SampleCountTransform(req.app["db"])])

    headers = {"Location": f"/labels/{document['id']}"}

    return json_response(document, status=201, headers=headers)


@routes.patch("/labels/{label_id}")
@schema(
    {
        "name": {
            "type": "string",
            "coerce": virtool.validators.strip,
        },
        "color": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "check_with": virtool.validators.is_valid_hex_color,
        },
        "description": {
            "type": "string",
            "coerce": virtool.validators.strip,
        },
    }
)
async def edit(req):
    """
    Edit an existing label.

    """
    data = req["data"]

    label_id = int(req.match_info["label_id"])

    if not data:
        raise EmptyRequest()

    async with AsyncSession(req.app["pg"]) as session:
        result = await session.execute(select(Label).filter_by(id=label_id))
        label = result.scalar()

        if label is None:
            raise NotFound()

        label.name = data["name"]
        label.color = data["color"]
        label.description = data["description"]
        document = label.to_dict()
        try:
            await session.commit()
        except IntegrityError:
            raise HTTPBadRequest(text="Label name already exists")

    document = await apply_transforms(document, [SampleCountTransform(req.app["db"])])

    return json_response(document)


@routes.delete("/labels/{label_id}")
async def remove(req):
    """
    Remove a label.

    """
    label_id = int(req.match_info["label_id"])

    async with AsyncSession(req.app["pg"]) as session:
        result = await session.execute(select(Label).filter_by(id=label_id))
        label = result.scalar()

        if label is None:
            raise NotFound()

        await session.delete(label)
        await session.commit()

    raise HTTPNoContent
