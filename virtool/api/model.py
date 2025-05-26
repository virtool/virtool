from pydantic import BaseModel, ConfigDict


class RequestModel(BaseModel):
    model_config = ConfigDict(
        use_attribute_docstrings=True,
    )
