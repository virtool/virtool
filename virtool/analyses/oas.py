from virtool.analyses.models import Analysis, AnalysisSearchResult


class FindAnalysesResponse(AnalysisSearchResult):
    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "created_at": "2022-08-15T17:42:35.979000Z",
                        "id": "ofv7rp4v",
                        "index": {"id": "u3lm1rk8", "version": 14},
                        "job": {"id": "us3toy8j"},
                        "ready": True,
                        "reference": {"id": "d19exr83", "name": "New Plant Viruses"},
                        "sample": {"id": "7tu8c5m5"},
                        "subtractions": [{"id": "1sk885at", "name": "Vitis vinifera"}],
                        "updated_at": "2022-08-15T17:42:35.979000Z",
                        "user": {
                            "administrator": True,
                            "handle": "mrott",
                            "id": "ihvze2u9",
                        },
                        "workflow": "pathoscope_bowtie",
                    }
                ],
                "found_count": 2621,
                "page": 1,
                "page_count": 105,
                "per_page": 25,
                "total_count": 2621,
            }
        }


class AnalysisResponse(Analysis):
    class Config:
        schema_extra = {
            "example": {
                "created_at": "2022-08-15T17:42:35.979000Z",
                "files": [
                    {
                        "analysis": "ofv7rp4v",
                        "description": None,
                        "format": "tsv",
                        "id": 3145,
                        "name": "report.tsv",
                        "name_on_disk": "3145-report.tsv",
                        "size": 4120,
                        "uploaded_at": "2022-08-15T17:48:02.467000Z",
                    }
                ],
                "id": "ofv7rp4v",
                "index": {"id": "u3lm1rk8", "version": 14},
                "job": {"id": "us3toy8j"},
                "ready": True,
                "reference": {"id": "d19exr83", "name": "New Plant Viruses"},
                "results": {
                    "hits": [
                        {
                            "abbreviation": "GLRaV3",
                            "id": "6tli5mz3",
                            "isolates": [
                                {
                                    "default": False,
                                    "id": "qauxg1g9",
                                    "sequences": [],
                                    "source_name": "WA-MR",
                                    "source_type": "isolate",
                                }
                            ],
                            "length": 18671,
                            "name": "Grapevine leafroll-associated virus 3",
                            "version": 30,
                        }
                    ],
                    "read_count": 584,
                    "subtracted_count": 0,
                },
                "sample": {"id": "7tu8c5m5"},
                "subtractions": [{"id": "1sk885at", "name": "Vitis vinifera"}],
                "updated_at": "2022-08-15T17:42:35.979000Z",
                "user": {"administrator": True, "handle": "mrott", "id": "ihvze2u9"},
                "workflow": "pathoscope_bowtie",
            }
        }
