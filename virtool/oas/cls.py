"""Utility to write Open Api Specifications using the Python language."""

from pydantic import BaseModel, ConfigDict, Field, model_serializer

from virtool.api.status import StatusCode


class OASRequestBody(BaseModel):
    content: dict
    """The content of the request body.

    Example:
    -------
    {
      "application/json": {
        "schema": {
          "$ref": "#/components/schemas/User"
        },
        "examples": {
              "user" : {
                "summary": "User Example",
                "externalValue": "http://foo.bar/examples/user-example.json"
              }
            }
        },
      }
    }

    """

    description: str
    """The description of the request body (eg. User to create)."""

    required: bool
    """Whether the request body is required."""


class OASParameter(BaseModel):
    """Represents a parameter in an OpenAPI specification."""

    model_config = ConfigDict(
        populate_by_name=True,
    )

    description: str
    """A brief description of the parameter."""

    name: str
    """The name of the parameter."""

    in_: str = Field(alias="in")
    """Where the parameter is located (eg. query, path, header)."""

    required: bool
    """Whether the parameter is required."""

    schema_: dict | None = Field(alias="schema", default=None)
    """The schema of the parameter."""


class OASResponse(BaseModel):
    content: dict
    description: str


class OASOperation(BaseModel):
    """Represents an operation in an OpenAPI specification."""

    description: str
    parameters: list[OASParameter]
    request_body: OASRequestBody | None
    responses: dict[StatusCode, OASResponse]
    summary: str


class OASPath(BaseModel):
    """Represents a path in an OpenAPI specification."""

    get: OASOperation | None = None
    patch: OASOperation | None = None
    post: OASOperation | None = None
    put: OASOperation | None = None
    delete: OASOperation | None = None

    description: str = ""
    summary: str = ""

    @model_serializer
    def serialize_model(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v is not None}


class OASComponents(BaseModel):
    schemas: dict
    security_schemes: dict[str, dict[str, str]] = Field(
        serialization_alias="securitySchemes",
    )


class OASInfo(BaseModel):
    description: str
    title: str
    version: str


class OAS3(BaseModel):
    components: OASComponents
    info: OASInfo
    paths: dict[str, OASPath]
    servers: list[dict[str, str]]
    openapi: str = "3.0.0"
