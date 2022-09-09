from typing import Optional, Union, List

from pydantic import BaseModel, constr, Field, root_validator, validator

ALLOWED_REMOTE = ["virtool/ref-plant-viruses"]
ALLOWED_DATA_TYPE = ["barcode", "genome"]


def check_data_type(data_type: str) -> str:
    """
    Checks that the data type is valid.
    """

    if data_type not in ALLOWED_DATA_TYPE:
        raise ValueError("data type not allowed")

    return data_type


class CreateReferenceSchema(BaseModel):
    name: constr(strip_whitespace=True) = Field(
        default="", description="the virus name"
    )
    description: constr(strip_whitespace=True) = Field(
        default="", description="a longer description for the reference"
    )
    data_type: str = Field(default="genome", description="the sequence data type")
    organism: str = Field(default="", description="the organism")
    release_id: Optional[str] = Field(
        default=11447367, description="the id of the GitHub release to install"
    )
    clone_from: Optional[str] = Field(
        description="a valid ref_id that the new reference should be cloned from"
    )
    import_from: Optional[str] = Field(
        description="a valid file_id that the new reference should be imported from"
    )
    remote_from: Optional[str] = Field(
        description="a valid GitHub slug to download and update the new reference from"
    )

    @root_validator
    def check_values(cls, values: Union[str, constr]):
        """
        Checks that only one of clone_from, import_from or remote_from are inputted, if any.
        """

        clone_from, import_from, remote_from = (
            values.get("clone_from"),
            values.get("import_from"),
            values.get("remote_from"),
        )

        if clone_from:
            if import_from or remote_from:
                raise ValueError(
                    "Only one of clone_from, import_from and remote_from are allowed"
                )
        elif import_from:
            if clone_from or remote_from:
                raise ValueError(
                    "Only one of clone_from, import_from and remote_from are allowed"
                )
        elif remote_from:
            if clone_from or import_from:
                raise ValueError(
                    "Only one of clone_from, import_from and remote_from are allowed"
                )

            if remote_from not in ALLOWED_REMOTE:
                raise ValueError("provided remote not allowed")

        return values

    _data_validation = validator("data_type", allow_reuse=True)(check_data_type)

    class Config:
        schema_extra = {
            "example": {
                "name": "Plant Viruses",
                "organism": "viruses",
                "data_type": "genome",
            }
        }


class CreateReferenceResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "cloned_from": {"id": "pat6xdn3", "name": "Plant Viruses"},
                "contributors": [
                    {
                        "administrator": True,
                        "count": 6,
                        "handle": "reece",
                        "id": "hjol9wdt",
                    },
                    {
                        "administrator": True,
                        "count": 7906,
                        "handle": "mrott",
                        "id": "ihvze2u9",
                    },
                    {
                        "administrator": True,
                        "count": 1563,
                        "handle": "igboyes",
                        "id": "igboyes",
                    },
                    {
                        "administrator": True,
                        "count": 2483,
                        "handle": "jasper",
                        "id": "1kg24j7t",
                    },
                ],
                "created_at": "2022-01-28T23:42:48.321000Z",
                "data_type": "genome",
                "description": "",
                "groups": [
                    {
                        "build": False,
                        "created_at": "2022-06-10T20:00:34.129000Z",
                        "id": "sidney",
                        "modify": False,
                        "modify_otu": False,
                        "remove": False,
                    }
                ],
                "id": "d19exr83",
                "internal_control": None,
                "latest_build": {
                    "created_at": "2022-07-05T17:41:51.857000Z",
                    "has_json": False,
                    "id": "u3lm1rk8",
                    "user": {
                        "administrator": True,
                        "handle": "mrott",
                        "id": "ihvze2u9",
                    },
                    "version": 14,
                },
                "name": "New Plant Viruses",
                "organism": "virus",
                "otu_count": 2102,
                "restrict_source_types": False,
                "source_types": ["isolate", "strain"],
                "task": {"id": 331},
                "unbuilt_change_count": 4,
                "user": {"administrator": True, "handle": "igboyes", "id": "igboyes"},
                "users": [
                    {
                        "administrator": True,
                        "build": True,
                        "handle": "igboyes",
                        "id": "igboyes",
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            }
        }


class GetReferencesResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "cloned_from": {"id": "pat6xdn3", "name": "Plant Viruses"},
                        "created_at": "2022-01-28T23:42:48.321000Z",
                        "data_type": "genome",
                        "groups": [
                            {
                                "build": False,
                                "created_at": "2022-06-10T20:00:34.129000Z",
                                "id": "sidney",
                                "modify": False,
                                "modify_otu": False,
                                "remove": False,
                            }
                        ],
                        "id": "d19exr83",
                        "internal_control": None,
                        "latest_build": {
                            "created_at": "2022-07-05T17:41:51.857000Z",
                            "has_json": False,
                            "id": "u3lm1rk8",
                            "user": {
                                "administrator": True,
                                "handle": "mrott",
                                "id": "ihvze2u9",
                            },
                            "version": 14,
                        },
                        "name": "New Plant Viruses",
                        "organism": "virus",
                        "otu_count": 2102,
                        "task": {"id": 331},
                        "unbuilt_change_count": 4,
                        "user": {"id": "igboyes"},
                        "users": [
                            {
                                "build": True,
                                "id": "igboyes",
                                "modify": True,
                                "modify_otu": True,
                                "remove": True,
                            },
                        ],
                    },
                ],
                "found_count": 2,
                "official_installed": True,
                "page": 1,
                "page_count": 1,
                "per_page": 25,
                "total_count": 2,
            }
        }


class ReferenceResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "cloned_from": {"id": "pat6xdn3", "name": "Plant Viruses"},
                "created_at": "2022-01-28T23:42:48.321000Z",
                "data_type": "genome",
                "groups": [
                    {
                        "build": False,
                        "created_at": "2022-06-10T20:00:34.129000Z",
                        "id": "sidney",
                        "modify": False,
                        "modify_otu": False,
                        "remove": False,
                    }
                ],
                "id": "d19exr83",
                "internal_control": None,
                "latest_build": {
                    "created_at": "2022-07-05T17:41:51.857000Z",
                    "has_json": False,
                    "id": "u3lm1rk8",
                    "user": {
                        "administrator": True,
                        "handle": "mrott",
                        "id": "ihvze2u9",
                    },
                    "version": 14,
                },
                "name": "New Plant Viruses",
                "organism": "virus",
                "otu_count": 2102,
                "task": {"id": 331},
                "unbuilt_change_count": 4,
                "user": {"id": "igboyes"},
                "users": [
                    {
                        "build": True,
                        "id": "igboyes",
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            },
        }


class ReferenceReleaseResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "id": 11449913,
                "name": "v0.1.2",
                "body": "#### Changed\r\n- add new isolates to Cucurbit chlorotic yellows virus",
                "etag": 'W/"b7e8a7fb0fbe0cade0d6a86c9e0d4549"',
                "filename": "reference.json.gz",
                "size": 3699729,
                "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v0.1.2",
                "download_url": "https://github.com/virtool/ref-plant-viruses/releases/download/v0.1.2/reference.json.gz",
                "published_at": "2018-06-12T21:52:33Z",
                "content_type": "application/gzip",
                "retrieved_at": "2018-06-14T19:52:17.465000Z",
                "newer": True,
            }
        }


class ReferenceTargetSchema(BaseModel):
    name: constr(min_length=1)
    description: constr(strip_whitespace=True) = Field(default="")
    required: bool = Field(default=False)
    length: Optional[int]


class EditReferenceSchema(BaseModel):
    name: Optional[constr(strip_whitespace=True, min_length=1)] = Field(description="the virus name")
    description: Optional[constr(strip_whitespace=True)] = Field(description="a longer description for the reference")
    organism: Optional[constr(strip_whitespace=True)] = Field(description="the organism")
    internal_control: Optional[str] = Field(description="set the OTU identified by the passed id as the internal control for the reference")
    restrict_source_types: Optional[bool] = Field(description="option to restrict source types")
    source_types: Optional[List[constr(strip_whitespace=True, min_length=1)]] = Field(description="source types")
    targets: List[ReferenceTargetSchema] = Field(description="targets")

    class Config:
        schema_extra = {
            "example": {
                "name": "Regulated Pests",
                "organism": "phytoplasma",
                "internal_control": "ah4m5jqz",
            }
        }


class ReferenceRightsSchema(BaseModel):
    build: Optional[bool] = Field(description="allow members to build new indexes for the reference")
    modify: Optional[bool] = Field(description="allow members to modify the reference metadata and settings")
    modify_otu: Optional[bool] = Field(description="allow members to modify the reference’s member OTUs")
    remove: Optional[bool] = Field(description="allow members to remove the reference")

    class Config:
        schema_extra = {"example": {"build": True, "modify": True}}


class CreateReferenceGroupsSchema(ReferenceRightsSchema):
    group_id: str = Field(description="the id of the group to add")

    class Config:
        schema_extra = {"example": {"group_id": "baz", "modify_otu": True}}


class CreateReferenceGroupResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": [
                {
                    "build": False,
                    "created_at": "2022-06-10T20:00:34.129000Z",
                    "id": "baz",
                    "modify": False,
                    "modify_otu": True,
                    "remove": False,
                }
            ]
        }


class ReferenceGroupsResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": [
                {
                    "build": False,
                    "created_at": "2022-06-10T20:00:34.129000Z",
                    "id": "sidney",
                    "modify": False,
                    "modify_otu": False,
                    "remove": False,
                }
            ]
        }


class ReferenceGroupResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "build": False,
                "created_at": "2022-06-10T20:00:34.129000Z",
                "id": "sidney",
                "modify": False,
                "modify_otu": False,
                "remove": False,
            }
        }


class CreateReferenceUsersSchema(ReferenceRightsSchema):
    user_id: str = Field(description="the id of the user to add")

    class Config:
        schema_extra = {"example": {"user_id": "sidney", "modify_otu": True}}


class ReferenceUsersSchema(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "id": "sidney",
                "created_at": "2018-05-23T19:14:04.285000Z",
                "build": False,
                "modify": False,
                "modify_otu": True,
                "remove": False,
            }
        }


class GetReferenceUpdateResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": [
                {
                    "id": 11447367,
                    "name": "v0.1.1",
                    "body": "#### Fixed\r\n- fixed uploading to GitHub releases in `.travis.yml`",
                    "filename": "reference.json.gz",
                    "size": 3695872,
                    "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v0.1.1",
                    "published_at": "2018-06-12T19:20:57Z",
                    "created_at": "2018-06-14T18:37:54.242000Z",
                    "user": {"id": "igboyes"},
                    "ready": True,
                }
            ]
        }


class CreateReferenceUpdateResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": {
                "id": 11447367,
                "name": "v0.1.1",
                "body": "#### Fixed\r\n- fixed uploading to GitHub releases in `.travis.yml`",
                "filename": "reference.json.gz",
                "size": 3695872,
                "html_url": "https://github.com/virtool/ref-plant-viruses/releases/tag/v0.1.1",
                "published_at": "2018-06-12T19:20:57Z",
                "created_at": "2018-06-14T18:37:54.242000Z",
                "user": {"id": "igboyes"},
                "ready": True,
            }
        }


class ReferenceOTUResponse(BaseModel):
    # Should be replaced by GetOTUResponse when it is converted to auto-doc.
    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "abbreviation": "ABTV",
                        "id": "k77wgf8x",
                        "name": "Abaca bunchy top virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 18,
                    },
                    {
                        "abbreviation": "AbBV",
                        "id": "7hpwj4yh",
                        "name": "Abutilon Brazil virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 4,
                    },
                    {
                        "abbreviation": "",
                        "id": "p9ohme8k",
                        "name": "Abutilon golden mosaic Yucatan virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "AbMBoV",
                        "id": "qrspg5w3",
                        "name": "Abutilon mosaic Bolivia virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 6,
                    },
                    {
                        "abbreviation": "AbMoBrV",
                        "id": "yb7kpm43",
                        "name": "Abutilon mosaic Brazil virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 4,
                    },
                    {
                        "abbreviation": "AbMV",
                        "id": "8540rw7b",
                        "name": "Abutilon mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 9,
                    },
                    {
                        "abbreviation": "",
                        "id": "3zwrpu3y",
                        "name": "Abutilon yellow mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AcLV",
                        "id": "30n6qo2x",
                        "name": "Aconitum latent virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "",
                        "id": "x5qw901r",
                        "name": "Actinidia chlorotic ringspot associated virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 5,
                    },
                    {
                        "abbreviation": "",
                        "id": "ss6bios9",
                        "name": "Actinidia emaravirus 2",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 13,
                    },
                    {
                        "abbreviation": "",
                        "id": "nn5gt7db",
                        "name": "Actinidia seed borne latent virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "xo3khtnd",
                        "name": "Actinidia virus 1",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 2,
                    },
                    {
                        "abbreviation": "AVA",
                        "id": "qg8optks",
                        "name": "Actinidia virus A",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AVB",
                        "id": "fnhtwiux",
                        "name": "Actinidia virus B",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AVX",
                        "id": "5uh1jzzk",
                        "name": "Actinidia virus X",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AYV1",
                        "id": "7ag9wwrr",
                        "name": "Actinidia yellowing virus 1",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "AYV2",
                        "id": "f87f3cs7",
                        "name": "Actinidia yellowing virus 2",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "e2xpkmgy",
                        "name": "Adonis mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "3ly2pqbk",
                        "name": "Aeonium ringspot virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 0,
                    },
                    {
                        "abbreviation": "",
                        "id": "3xa1dbt0",
                        "name": "African cassava mosaic Burkina Faso virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 5,
                    },
                    {
                        "abbreviation": "ACMV",
                        "id": "0ommwgyh",
                        "name": "African cassava mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 9,
                    },
                    {
                        "abbreviation": "",
                        "id": "iyw0y3ta",
                        "name": "African eggplant mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "set9w2zc",
                        "name": "African eggplant yellowing virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "AOPRV",
                        "id": "taecz4c9",
                        "name": "African oil palm ringspot virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 2,
                    },
                    {
                        "abbreviation": "",
                        "id": "zgsytbul",
                        "name": "Agave tequilana leaf virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 2,
                    },
                ],
                "found_count": 2102,
                "modified_count": 1,
                "page": 1,
                "page_count": 85,
                "per_page": 25,
                "total_count": 2102,
            }
        }


class ReferenceIndexResponse(BaseModel):
    # Should be replaced by GetIndexResponse when it is converted to auto-doc.
    class Config:
        schema_extra = {
            "example": {
                "change_count": 4,
                "documents": [
                    {
                        "change_count": 15,
                        "created_at": "2022-07-05T17:41:51.857000Z",
                        "has_files": True,
                        "id": "u3lm1rk8",
                        "job": {"id": "lj96kiko"},
                        "modified_otu_count": 3,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 14,
                    },
                    {
                        "change_count": 3,
                        "created_at": "2022-05-05T15:50:17.234000Z",
                        "has_files": True,
                        "id": "9c5u6wsq",
                        "job": {"id": "0do7gsbx"},
                        "modified_otu_count": 1,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 13,
                    },
                    {
                        "change_count": 3,
                        "created_at": "2022-05-04T23:07:37.405000Z",
                        "has_files": True,
                        "id": "qollajsh",
                        "job": {"id": "le7a1dgn"},
                        "modified_otu_count": 2,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 12,
                    },
                    {
                        "change_count": 1,
                        "created_at": "2022-04-19T16:03:15.255000Z",
                        "has_files": True,
                        "id": "sgcwpp2d",
                        "job": {"id": "edn2y86c"},
                        "modified_otu_count": 1,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 11,
                    },
                    {
                        "change_count": 10,
                        "created_at": "2022-04-14T03:10:23.533000Z",
                        "has_files": True,
                        "id": "ec3yjyqz",
                        "job": {"id": "nessd7v6"},
                        "modified_otu_count": 1,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 10,
                    },
                    {
                        "change_count": 100,
                        "created_at": "2022-03-01T20:21:48.287000Z",
                        "has_files": True,
                        "id": "flp5v6fq",
                        "job": {"id": "xyhomto0"},
                        "modified_otu_count": 17,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 9,
                    },
                    {
                        "change_count": 1560,
                        "created_at": "2022-03-01T00:43:47.669000Z",
                        "has_files": True,
                        "id": "8s9rjabx",
                        "job": {"id": "2w4u4nay"},
                        "modified_otu_count": 218,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 8,
                    },
                    {
                        "change_count": 947,
                        "created_at": "2022-02-26T19:16:18.432000Z",
                        "has_files": True,
                        "id": "a6j5wiqv",
                        "job": {"id": "sk2mwiuh"},
                        "modified_otu_count": 203,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 7,
                    },
                    {
                        "change_count": 935,
                        "created_at": "2022-02-25T19:08:13.785000Z",
                        "has_files": True,
                        "id": "1dirn43r",
                        "job": {"id": "yfjmc5ci"},
                        "modified_otu_count": 200,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 6,
                    },
                    {
                        "change_count": 1530,
                        "created_at": "2022-02-24T00:36:04.219000Z",
                        "has_files": True,
                        "id": "4fk8ealu",
                        "job": {"id": "hw58mwiy"},
                        "modified_otu_count": 253,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 5,
                    },
                    {
                        "change_count": 1724,
                        "created_at": "2022-02-22T15:20:06.329000Z",
                        "has_files": True,
                        "id": "uico01f3",
                        "job": {"id": "1h5zn2zw"},
                        "modified_otu_count": 426,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 4,
                    },
                    {
                        "change_count": 1816,
                        "created_at": "2022-02-19T19:34:51.644000Z",
                        "has_files": True,
                        "id": "lyovzl76",
                        "job": {"id": "92g9pxnk"},
                        "modified_otu_count": 387,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "version": 3,
                    },
                    {
                        "change_count": 1204,
                        "created_at": "2022-02-17T17:53:12.976000Z",
                        "has_files": True,
                        "id": "t4h7imlw",
                        "job": {"id": "jmw6w812"},
                        "modified_otu_count": 299,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "jasper",
                            "id": "1kg24j7t",
                        },
                        "version": 2,
                    },
                    {
                        "change_count": 543,
                        "created_at": "2022-02-16T16:29:23.246000Z",
                        "has_files": True,
                        "id": "orbufadv",
                        "job": {"id": "l6dwjhsl"},
                        "modified_otu_count": 102,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "jasper",
                            "id": "1kg24j7t",
                        },
                        "version": 1,
                    },
                    {
                        "change_count": 1563,
                        "created_at": "2022-01-28T23:53:31.335000Z",
                        "has_files": True,
                        "id": "qwp7rnmg",
                        "job": {"id": "pio1bjfy"},
                        "modified_otu_count": 1563,
                        "ready": True,
                        "reference": {"id": "d19exr83"},
                        "user": {
                            "administrator": True,
                            "handle": "igboyes",
                            "id": "igboyes",
                        },
                        "version": 0,
                    },
                ],
                "found_count": 15,
                "modified_otu_count": 1,
                "page": 1,
                "page_count": 1,
                "per_page": 25,
                "total_count": 15,
                "total_otu_count": 2102,
            }
        }
