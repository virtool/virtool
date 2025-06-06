from pydantic import BaseModel, Field, constr


class UpdateSettingsRequest(BaseModel):
    sample_group: str | None = "none"
    sample_group_read: bool = True
    sample_group_write: bool = False
    sample_all_read: bool = True
    sample_all_write: bool = False
    hmm_slug: constr(strip_whitespace=True) = "virtool/virtool-hmm"
    enable_api: bool = False
    enable_sentry: bool = True
    minimum_password_length: int = 8
    default_source_types: list = Field(default_factory=lambda: ["isolate", "strain"])
