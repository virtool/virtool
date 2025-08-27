import math
import re

from aiohttp.web_response import Response
from multidict import MultiDictProxy

from virtool.types import Projection
from virtool.utils import coerce_list


def set_session_id_cookie(resp: Response, session_id: str) -> None:
    resp.set_cookie("session_id", session_id, httponly=True, max_age=2600000)


def set_session_token_cookie(resp: Response, session_token: str) -> None:
    resp.set_cookie("session_token", session_token, httponly=True, max_age=2600000)


def compose_regex_query(
    term: str,
    fields: list[str],
) -> dict[str, list[dict[str, dict]]]:
    """Compose a MongoDB query that checks if the values of the passed `fields` match
    the passed search `term`.

    :param term: the term to search
    :param fields: the list of field to match against
    :return: a query

    """
    if not isinstance(fields, (list, tuple)):
        raise TypeError("Type of 'fields' must be one of 'list' or 'tuple'")

    regex = re.compile(str(re.escape(term)), re.IGNORECASE)

    return {
        "$or": [
            {field: {"$regex": regex}}
            for field in [str(field) for field in coerce_list(fields)]
        ],
    }


async def paginate(
    collection,
    mongo_query: dict | MultiDictProxy[str],
    url_query: dict | MultiDictProxy[str],
    base_query: dict | None = None,
    projection: Projection | None = None,
    reverse: bool = False,
    sort: list[tuple[str, int]] | str | None = None,
):
    """A function for searching and paging collections.

    Uses a number of different queries to return search results.

    The `db_query` is composed is passed in the function call. This is usually derived
    from user input such as search terms and filter options. This documents matching
    query will count toward the returned `found_count`.

    The `url_query` is the raw query from the request URL. This value is used to derive
    the `page` and `per_page` numbers used in paging the search results.

    The `base_query` is affects the `total_count` of documents in the collection
    returned to the API client. An example where this is used is only ever returning
    documents that have a `ready` field set to `True`. If the field is `False`, the
    client would never know the document existed.

    The function returns a dictionary containing the matching `documents` and metadata
    about the search.

    `total_count`: the total number of unhidden documents in the collection
    `found_count`: the number of documents matching the search query (`db_query`)
    `page_count`: the number of pages given the passed `per_page` value
    `per_page`: the `documents` to return for each page request
    `page`: the page number to return (starts at one)

    :param collection: the database collection
    :param mongo_query: a query derived from user supplied - affects found count
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

    mongo_query = {"$and": [base_query, mongo_query]}

    cursor = collection.find(mongo_query, projection, sort=sort)

    found_count = await collection.count_documents(mongo_query)

    page_count = int(math.ceil(found_count / per_page))

    documents = []

    if found_count:
        if page > 1:
            cursor.skip((page - 1) * per_page)

        documents = await cursor.to_list(per_page)

    total_count = await collection.count_documents(base_query)

    return {
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page_count": page_count,
        "per_page": per_page,
        "page": page,
    }
