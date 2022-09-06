import asyncio
import math
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Union, Mapping, Any

from aiohttp.web import Request
from multidict import MultiDictProxy

from virtool.types import Projection, Document
from virtool.utils import coerce_list, to_bool


@dataclass
class Paginated:
    documents: List[Document]
    page: int
    page_count: int
    per_page: int
    found_count: int
    total_count: int


def compose_exists_query(field: str) -> Dict[str, Dict[str, bool]]:
    """
    Compose a MongoDB query that checks if the passed `field` exists.

    :param field: the field to check for existence
    :return: a query

    """
    return {field: {"$exists": True}}


def compose_regex_query(term, fields: List[str]) -> Dict[str, List[Dict[str, dict]]]:
    """
    Compose a MongoDB query that checks if the values of the passed `fields` match the
    passed search `term`.

    :param term: the term to search
    :param fields: the list of field to match against
    :return: a query

    """
    if not isinstance(fields, (list, tuple)):
        raise TypeError("Type of 'fields' must be one of 'list' or 'tuple'")

    term = re.escape(term)

    regex = re.compile(str(term), re.IGNORECASE)

    return {
        "$or": [
            {field: {"$regex": regex}}
            for field in [str(field) for field in coerce_list(fields)]
        ]
    }


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

    documents = []

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


async def paginate_aggregate(
    collection,
    db_query: Union[Dict, MultiDictProxy[str]],
    url_query: Union[Dict, MultiDictProxy[str]],
    sort: Optional[Union[List[Tuple[str, int]], str]] = None,
    base_query: Optional[Dict] = None,
    reverse: bool = False,
):
    """
    A function to return parameters used in aggregate.

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

    `total_count`: the total number of unhidden documents in the collection
    `found_count`: the number of documents matching the search query (`db_query`)
    `page_count`: the number of pages given the passed `per_page` value
    `per_page`: the `documents` to return for each page request
    `page`: the page number to return (starts at one)
    'sort': field to sort by
    'skip_count': number of documents to skip

    :param collection: the database collection
    :param db_query: a query derived from user supplied - affects found count
    :param url_query: the raw URL query; used to get the `page` and `page_count` values
    :param sort: a field to sort by
    :param base_query: a query always applied to the search
    :param reverse: reverse the sort order

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
        sort = {sort: -1 if reverse else 1}

    db_query = {"$and": [base_query, db_query]}

    found_count = await collection.count_documents(db_query)

    page_count = int(math.ceil(found_count / per_page))

    total_count = await collection.count_documents(base_query)

    skip_count = 0

    if found_count and page > 1:
        skip_count = (page - 1) * per_page

    return {
        "sort": sort,
        "total_count": total_count,
        "found_count": found_count,
        "page_count": page_count,
        "per_page": per_page,
        "page": page,
        "skip_count": skip_count,
    }


async def paginate2(
    collection,
    page: int,
    per_page: int,
    query: Union[Dict, MultiDictProxy[str]],
    base_query: Optional[Dict] = None,
    projection: Optional[Projection] = None,
    reverse: bool = False,
    sort: Optional[Union[List[Tuple[str, int]], str]] = None,
) -> Paginated:
    """
    A function for searching and paging collections.

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
    :param query: a query to search by
    :param base_query: a query to filter by prior to searching
    :param sort: a field to sort by
    :param projection: the projection to apply to the returned documents
    :param base_query: a query always applied to the search
    :param reverse: reverse the sort order
    :return: a search result including a list of matched documents

    """
    base_query = base_query or {}

    if isinstance(sort, str):
        sort = [(sort, -1 if reverse else 1)]

    search_query = {"$and": [base_query, query]}

    cursor = collection.find(search_query, projection, sort=sort)

    found_count, total_count = await asyncio.gather(
        collection.count_documents(search_query), collection.count_documents(base_query)
    )

    if page > 1:
        cursor.skip((page - 1) * per_page)

    documents = [
        await collection.apply_processor(d)
        for d in await asyncio.shield(cursor.to_list(per_page))
    ]

    return Paginated(
        documents=documents,
        found_count=found_count,
        total_count=total_count,
        page=page,
        page_count=int(math.ceil(found_count / per_page)),
        per_page=per_page,
    )


def get_query_bool(query: Mapping, key: str, default: Optional[Any] = None) -> bool:
    """
    Return a `bool` calculated from a URL query given its `key`.

    :param query: the URL query
    :param key: the URL query key
    :param default: the default to return if the value is not present
    :return: the derived boolean value

    """
    try:
        return to_bool(query[key])
    except KeyError:
        return default


def get_req_bool(req: Request, key: str, default: Optional[Any] = None) -> bool:
    """
    Return a `bool` calculated from the request's query given its `key`.

    :param req: the request
    :param key: the URL query key
    :param default: the default to return if the key is not present
    :return: the derived boolean value

    """
    return get_query_bool(req.query, key, default)
