from pydantic import validator

from virtool.models.base import BaseModel


class HMMMinimal(BaseModel):
    id: int
    cluster: int
    count: int
    families: dict[str, int]
    names: list[str]

    @validator("names")
    def is_name_valid(cls, names: list[str]) -> list[str]:
        if len(names) > 3:
            raise ValueError("The length of name should be a maximum of 3")

        return names


class HMMSequenceEntry(BaseModel):
    accession: str
    gi: str
    name: str
    organism: str


class HMM(HMMMinimal):
    entries: list[HMMSequenceEntry]
    genera: dict[str, int]
    length: int
    mean_entropy: float
    total_entropy: float
