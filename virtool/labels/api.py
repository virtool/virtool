from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.http.routes
import virtool.utils
import virtool.validators
import virtool.db.utils
from virtool.api.response import bad_request, empty_request, json_response, no_content, not_found
from virtool.models import Label

routes = virtool.http.routes.Routes()


@routes.get("/api/labels")
async def find(req):
    """
    Get a list of all label documents in the database.

    """
    document = list()
    async with AsyncSession(req.app["postgres"]) as session:
        result = await session.execute(select(Label))
        labels = result.scalars().all()
        for label in labels:
            d = {
                "id": label.id,
                "name": label.name,
                "color": label.color,
                "description": label.description
            }
            document.append(d)

    return json_response(document)


@routes.get("/api/labels/{label_id}")
async def get(req):
    """
    Get a complete label document.

    """
    async with AsyncSession(req.app["postgres"]) as session:
        result = await session.execute(select(Label).filter_by(id=req.match_info["label_id"]))
        label = result.scalar()
        if label is None:
            return not_found()

        d = {
            "id": label.id,
            "name": label.name,
            "color": label.color,
            "description": label.description
        }

    return json_response(virtool.utils.base_processor(d))


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
    db = req.app["db"]
    data = req["data"]

    async with AsyncSession(req.app["postgres"]) as session:
        result = await session.execute(select(Label).filter_by(name=data["name"]))
        if result.scalars().all():
            return bad_request("Label name already exists")

        label_id = await virtool.db.utils.get_new_id(db.labels)

        label = Label(id=label_id, name=data["name"], color=data["color"], description=data["description"])
        session.add(label)

    document = {
        "_id": label_id,
        "name": data["name"],
        "color": data["color"],
        "description": data["description"]
    }

    headers = {
        "Location": f"/api/labels/{label_id}"
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


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

    label_id = req.match_info["label_id"]

    if not data:
        return empty_request()

    async with AsyncSession(req.app["postgres"]) as session:
        result = await session.execute(select(Label).filter(Label.id != label_id, Label.name == data["name"]))
        if "name" in data and len(result.scalars().all()) > 0:
            return bad_request("Label name already exists")

        result = await session.execute(select(Label).filter_by(id=label_id))
        label = result.scalar()
        if label is None:
            return not_found()

        label.name = data["name"]
        label.color = data["color"]
        label.description = data["description"]
        await session.commit()

    document = {
        "_id": label_id,
        "name": data["name"],
        "color": data["color"],
        "description": data["description"]
    }
    return json_response(virtool.utils.base_processor(document))


@routes.delete("/api/labels/{label_id}")
async def remove(req):
    """
    Remove a label.

    """
    db = req.app["db"]

    label_id = req.match_info["label_id"]

    delete_result = await db.labels.delete_one({"_id": label_id})

    if delete_result.deleted_count == 0:
        return not_found()

    return no_content()
