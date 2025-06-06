from pydantic import BaseModel as PydanticBaseModel, root_validator


class BaseModel(PydanticBaseModel):
    @root_validator(pre=True)
    def convert_id(cls, values):
        if "_id" in values:
            values["id"] = values.pop("_id")
        return values
