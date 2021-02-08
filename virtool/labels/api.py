import asyncio

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.http.routes
import virtool.validators
import virtool.db.utils
import virtool.labels.db
from virtool.api.response import bad_request, empty_request, json_response, no_content, not_found
from virtool.labels.models import Label

routes = virtool.http.routes.Routes()


@routes.get("/api/labels")
async def find(req):
    """
    Get a list of all label documents in the database.

    """
    documents = list()
    async with AsyncSession(req.app["postgres"]) as session:
        result = await session.execute(select(Label))
        labels = result.scalars().all()
        for label in labels:
            documents.append(label.to_dict())

    documents = await asyncio.gather(*[virtool.labels.db.attach_sample_count(req.app["db"], d) for d in documents])

    return json_response(documents)


@routes.get("/api/labels/{label_id}")
async def get(req):
    """
    Get a complete label document.

    """
    async with AsyncSession(req.app["postgres"]) as session:
        result = await session.execute(select(Label).filter_by(id=int(req.match_info["label_id"])))
        label = result.scalar()

        if label is None:
            return not_found()

    document = await virtool.labels.db.attach_sample_count(req.app["db"], label.to_dict())

    return json_response(document)


@routes.post("/api/labels", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "required": True,
        "empty": False
    },
    "color": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "validator": virtool.validators.is_valid_hex_color,
        "default": "#A0AEC0"
    },
    "description": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ""
    }
})
async def create(req):
    """
    Add a new label to the labels database.

    """
    data = req["data"]

    async with AsyncSession(req.app["postgres"]) as session:
        label = Label(name=data["name"], color=data["color"], description=data["description"])
        session.add(label)

        try:
            await session.flush()
            document = label.to_dict()
            await session.commit()
        except IntegrityError:
            return bad_request("Label name already exists")

    document = await virtool.labels.db.attach_sample_count(req.app["db"], document)

    headers = {
        "Location": f"/api/labels/{document['id']}"
    }

    return json_response(document, status=201, headers=headers)


@routes.patch("/api/labels/{label_id}", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
    },
    "color": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "validator": virtool.validators.is_valid_hex_color,
    },
    "description": {
        "type": "string",
        "coerce": virtool.validators.strip,
    }
})
async def edit(req):
    """
    Edit an existing label.

    """
    data = req["data"]

    label_id = int(req.match_info["label_id"])

    if not data:
        return empty_request()

    async with AsyncSession(req.app["postgres"]) as session:
        result = await session.execute(select(Label).filter_by(id=label_id))
        label = result.scalar()

        if label is None:
            return not_found()

        label.name = data["name"]
        label.color = data["color"]
        label.description = data["description"]
        document = label.to_dict()
        try:
            await session.commit()
        except IntegrityError:
            return bad_request("Label name already exists")

    document = await virtool.labels.db.attach_sample_count(req.app["db"], document)

    return json_response(document)


@routes.delete("/api/labels/{label_id}")
async def remove(req):
    """
    Remove a label.

    """
    label_id = int(req.match_info["label_id"])

    async with AsyncSession(req.app["postgres"]) as session:
        result = await session.execute(select(Label).filter_by(id=label_id))
        label = result.scalar()

        if label is None:
            return not_found()

        session.delete(label)
        await session.commit()

    return no_content()
