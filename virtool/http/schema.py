import cerberus

from virtool.types import RouteHandler


def schema(schema_dict: dict):
    """Set the schema for a :class:`virtool.types.RouteHandler`."""
    validator = cerberus.Validator(schema_dict)

    def _assign_schema(handler: RouteHandler):
        handler.schema_validator = validator
        return handler

    return _assign_schema
