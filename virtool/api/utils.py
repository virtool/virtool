import asyncio
import math
import re

import virtool.users.utils
import virtool.utils


def compose_regex_query(term, fields):
    if not isinstance(fields, (list, tuple)):
        raise TypeError("Type of 'fields' must be one of 'list' or 'tuple'")

    # Stringify fields.
    fields = [str(field) for field in virtool.utils.coerce_list(fields)]

    term = re.escape(term)

    # Compile regex, making is case-insensitive.
    regex = re.compile(str(term), re.IGNORECASE)

    # Compose and return $or-based query.
    return {
        "$or": [{field: {"$regex": regex}} for field in fields]
    }


async def paginate(
        collection,
        db_query,
        url_query,
        sort=None,
        projection=None,
        base_query=None,
        reverse=False
):
    try:
        page = int(url_query["page"])
    except (KeyError, ValueError):
        page = 1

    try:
        per_page = int(url_query["per_page"])
    except (KeyError, ValueError):
        per_page = 25

    base_query = base_query or {}

    if isinstance(sort, str):
        sort = [(sort, -1 if reverse else 1)]

    db_query = {
        "$and": [base_query, db_query]
    }

    cursor = collection.find(
        db_query,
        projection,
        sort=sort
    )

    found_count = await collection.count_documents(db_query)

    page_count = int(math.ceil(found_count / per_page))

    documents = list()

    if found_count:
        if page > 1:
            cursor.skip((page - 1) * per_page)

        documents = [await collection.apply_processor(d) for d in await asyncio.shield(cursor.to_list(per_page))]

    total_count = await collection.count_documents(base_query)

    return {
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page_count": page_count,
        "per_page": per_page,
        "page": page
    }


def get_query_bool(req, key):
    try:
        short = req.query[key]
        return virtool.utils.to_bool(short)
    except KeyError:
        return False
