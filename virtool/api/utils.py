import asyncio
import math
import re
from typing import Dict, List, Optional, Tuple, Union

import aiohttp.web
from multidict import MultiDictProxy

import virtool.users.utils
import virtool.utils
from virtool.types import Projection


def compose_exists_query(field: str) -> Dict[str, Dict[str, bool]]:
    """
    Compose a MongoDB query that checks if the passed `field` exists.

    :param field: the field to check for existence
    :return: a query

    """
    return {field: {"$exists": True}}


def compose_regex_query(term, fields: List[str]) -> Dict[str, List[Dict[str, dict]]]:
    """
    Compose a MongoDB query that checks if the values of the passed `fields` match the passed
    search `term`.

    :param term: the term to search
    :param fields: the list of field to match against
    :return: a query

    """
    if not isinstance(fields, (list, tuple)):
        raise TypeError("Type of 'fields' must be one of 'list' or 'tuple'")

    # Stringify fields.
    fields = [str(field) for field in virtool.utils.coerce_list(fields)]

    term = re.escape(term)

    # Compile regex, making is case-insensitive.
    regex = re.compile(str(term), re.IGNORECASE)

    # Compose and return $or-based query.
    return {"$or": [{field: {"$regex": regex}} for field in fields]}


async def paginate(
    collection,
    db_query: Union[Dict, MultiDictProxy[str]],
    url_query: Union[Dict, MultiDictProxy[str]],
    sort: Optional[Union[List[Tuple[str, int]], str]] = None,
    projection: Optional[Projection] = None,
    base_query: Optional[Dict] = None,
    reverse: bool = False,
):
    """
    A function for searching and paging collections.

    Uses a number of different queries to return search results.

    The `db_query` is composed is passed in the function call. This is usually derived from user
    input such as search terms and filter options. This documents matching query will count toward
    the returned `found_count`.

    The `url_query` is the raw query from the request URL. This value is used to derive the `page`
    and `per_page` numbers used in paging the search results.

    The `base_query` is affects the `total_count` of documents in the collection returned to the
    API client. An example where this is used is only ever returning documents that have a `ready`
    field set to `True`. If the field is `False`, the client would never know the document existed.

    The function returns a dictionary containing the matching `documents` and metadata about the
    search.

    `total_count`: the total number of documents the API client should see are in the collection
    `found_count`: the number of documents matching the search query (`db_query`)
    `page_count`: the number of pages given the passed `per_page` value
    `per_page`: the `documents` to return for each page request
    `page`: the page number to return (starts at one)

    :param collection: the database collection
    :param db_query: a query derived from user supplied - affects found count
    :param url_query: the raw URL query; used to get the `page` and `page_count` values
    :param sort: a field to sort by
    :param projection: the projection to apply to the returned documents
    :param base_query: a query always applied to the search
    :param reverse: reverse the sort order
    :return: a search result including a list of matched documents

    """
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

    db_query = {"$and": [base_query, db_query]}

    cursor = collection.find(db_query, projection, sort=sort)

    found_count = await collection.count_documents(db_query)

    page_count = int(math.ceil(found_count / per_page))

    documents = list()

    if found_count:
        if page > 1:
            cursor.skip((page - 1) * per_page)

        documents = [
            await collection.apply_processor(d)
            for d in await asyncio.shield(cursor.to_list(per_page))
        ]

    total_count = await collection.count_documents(base_query)

    return {
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page_count": page_count,
        "per_page": per_page,
        "page": page,
    }


def get_query_bool(req: aiohttp.web.Request, key: str) -> bool:
    """
    Return a `bool` calculated from a URL query given its `key`.

    :param req: the request
    :param key: the URL query key
    :return: the derived boolean value

    """
    try:
        short = req.query[key]
        return virtool.utils.to_bool(short)
    except KeyError:
        return False
