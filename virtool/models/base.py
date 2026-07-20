from pydantic import BaseModel as PydanticBaseModel


class BaseModel(PydanticBaseModel):
    """Shared base for Virtool resource models.

    A single import point for every resource and request/response model in the package.
    The Mongo ``_id``-to-``id`` rename that once lived here as a blanket pre-validator is
    gone: the migration off Mongo left the OTU domain as the only producer of ``_id``
    documents, which now shape their own public ``id`` at the blob boundary (see
    ``virtool.otus.utils.format_otu`` and ``format_sequence``).
    """
