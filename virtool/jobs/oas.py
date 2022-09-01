from virtool_core.models.job import JobMinimal, Job


class GetJobResponse(JobMinimal):
    class Config:
        schema_extra = {
            "example": [
                {
                    "archived": False,
                    "created_at": "2022-07-08T18:37:44.936000Z",
                    "id": "splu0pq3",
                    "progress": 100,
                    "rights": {
                        "analyses": {
                            "modify": [
                                "rr8iryfy"
                            ],
                            "read": [
                                "rr8iryfy"
                            ],
                            "remove": [
                                "rr8iryfy"
                            ]
                        },
                        "indexes": {
                            "read": [
                                "u3lm1rk8"
                            ]
                        },
                        "references": {
                            "read": [
                                "d19exr83"
                            ]
                        },
                        "samples": {
                            "read": [
                                "4eynwmic"
                            ]
                        },
                        "subtractions": {
                            "read": [
                                "0nhpi36p"
                            ]
                        }
                    },
                    "stage": "",
                    "state": "complete",
                    "status": [
                        {
                            "error": None,
                            "progress": 0,
                            "stage": None,
                            "state": "waiting",
                            "step_description": None,
                            "step_name": None,
                            "timestamp": "2022-07-08T18:37:44.936000Z"
                        },
                        {
                            "error": None,
                            "progress": 3,
                            "stage": None,
                            "state": "preparing",
                            "step_description": None,
                            "step_name": None,
                            "timestamp": "2022-07-08T18:41:20.647000Z"
                        },
                        {
                            "error": None,
                            "progress": 16,
                            "stage": "eliminate_otus",
                            "state": "running",
                            "step_description": "Map sample reads to reference OTUs and discard.",
                            "step_name": "Eliminate Otus",
                            "timestamp": "2022-07-08T18:48:11.287000Z"
                        },
                        {
                            "error": None,
                            "progress": 33,
                            "stage": "eliminate_subtraction",
                            "state": "running",
                            "step_description": "Map remaining reads to the subtraction and discard.",
                            "step_name": "Eliminate Subtraction",
                            "timestamp": "2022-07-08T19:00:24.291000Z"
                        },
                        {
                            "error": None,
                            "progress": 50,
                            "stage": "reunite_pairs",
                            "state": "running",
                            "step_description": "Reunite paired reads after elimination.",
                            "step_name": "Reunite Pairs",
                            "timestamp": "2022-07-08T19:02:53.618000Z"
                        },
                        {
                            "error": None,
                            "progress": 66,
                            "stage": "assemble",
                            "state": "running",
                            "step_description": "Assemble reads using SPAdes.",
                            "step_name": "Assemble",
                            "timestamp": "2022-07-08T19:02:53.644000Z"
                        },
                        {
                            "error": None,
                            "progress": 83,
                            "stage": "process_fasta",
                            "state": "running",
                            "step_description": "Find ORFs in the assembled contigs.",
                            "step_name": "Process Fasta",
                            "timestamp": "2022-07-08T19:07:22.352000Z"
                        },
                        {
                            "error": None,
                            "progress": 100,
                            "stage": "vfam",
                            "state": "running",
                            "step_description": "Search for viral motifs in ORF translations.",
                            "step_name": "Vfam",
                            "timestamp": "2022-07-08T19:07:44.531000Z"
                        },
                        {
                            "error": None,
                            "progress": 100,
                            "stage": "",
                            "state": "complete",
                            "step_description": None,
                            "step_name": None,
                            "timestamp": "2022-07-08T19:13:04.293000Z"
                        }
                    ],
                    "user": {
                        "administrator": False,
                        "handle": "jonathan",
                        "id": "88yksx67"
                    },
                    "workflow": "nuvs"
                },
                {
                    "archived": False,
                    "created_at": "2022-07-08T20:07:29.213000Z",
                    "id": "qs3d5bnp",
                    "progress": 100,
                    "rights": {
                        "analyses": {
                            "modify": [
                                "z436i72k"
                            ],
                            "read": [
                                "z436i72k"
                            ],
                            "remove": [
                                "z436i72k"
                            ]
                        },
                        "indexes": {
                            "read": [
                                "u3lm1rk8"
                            ]
                        },
                        "references": {
                            "read": [
                                "d19exr83"
                            ]
                        },
                        "samples": {
                            "read": [
                                "90xccap9"
                            ]
                        },
                        "subtractions": {
                            "read": [
                                "0nhpi36p"
                            ]
                        }
                    },
                    "stage": "",
                    "state": "complete",
                    "status": [
                        {
                            "error": None,
                            "progress": 0,
                            "stage": None,
                            "state": "waiting",
                            "step_description": None,
                            "step_name": None,
                            "timestamp": "2022-07-08T20:07:29.213000Z"
                        },
                        {
                            "error": None,
                            "progress": 3,
                            "stage": None,
                            "state": "preparing",
                            "step_description": None,
                            "step_name": None,
                            "timestamp": "2022-07-08T20:11:22.187000Z"
                        },
                        {
                            "error": None,
                            "progress": 16,
                            "stage": "eliminate_otus",
                            "state": "running",
                            "step_description": "Map sample reads to reference OTUs and discard.",
                            "step_name": "Eliminate Otus",
                            "timestamp": "2022-07-08T20:16:11.688000Z"
                        },
                        {
                            "error": None,
                            "progress": 33,
                            "stage": "eliminate_subtraction",
                            "state": "running",
                            "step_description": "Map remaining reads to the subtraction and discard.",
                            "step_name": "Eliminate Subtraction",
                            "timestamp": "2022-07-08T20:22:29.872000Z"
                        },
                        {
                            "error": None,
                            "progress": 50,
                            "stage": "reunite_pairs",
                            "state": "running",
                            "step_description": "Reunite paired reads after elimination.",
                            "step_name": "Reunite Pairs",
                            "timestamp": "2022-07-08T20:23:59.985000Z"
                        },
                        {
                            "error": None,
                            "progress": 66,
                            "stage": "assemble",
                            "state": "running",
                            "step_description": "Assemble reads using SPAdes.",
                            "step_name": "Assemble",
                            "timestamp": "2022-07-08T20:24:00.127000Z"
                        },
                        {
                            "error": None,
                            "progress": 83,
                            "stage": "process_fasta",
                            "state": "running",
                            "step_description": "Find ORFs in the assembled contigs.",
                            "step_name": "Process Fasta",
                            "timestamp": "2022-07-08T20:30:17.383000Z"
                        },
                        {
                            "error": None,
                            "progress": 100,
                            "stage": "vfam",
                            "state": "running",
                            "step_description": "Search for viral motifs in ORF translations.",
                            "step_name": "Vfam",
                            "timestamp": "2022-07-08T20:30:36.530000Z"
                        },
                        {
                            "error": None,
                            "progress": 100,
                            "stage": "",
                            "state": "complete",
                            "step_description": None,
                            "step_name": None,
                            "timestamp": "2022-07-08T20:39:54.874000Z"
                        }
                    ],
                    "user": {
                        "administrator": False,
                        "handle": "jonathan",
                        "id": "88yksx67"
                    },
                    "workflow": "nuvs"
                }, ]
        }


class JobResponse(Job):
    class Config:
        schema_extra = {
            "example": {
                "acquired": True,
                "archived": False,
                "args": {
                    "analysis_id": "rr8iryfy",
                    "index_id": "u3lm1rk8",
                    "ref_id": "d19exr83",
                    "sample_id": "4eynwmic",
                    "sample_name": "21BP088",
                    "subtractions": [
                        "0nhpi36p"
                    ]
                },
                "created_at": "2022-07-08T18:37:44.936000Z",
                "id": "splu0pq3",
                "progress": 100,
                "rights": {
                    "analyses": {
                        "modify": [
                            "rr8iryfy"
                        ],
                        "read": [
                            "rr8iryfy"
                        ],
                        "remove": [
                            "rr8iryfy"
                        ]
                    },
                    "indexes": {
                        "read": [
                            "u3lm1rk8"
                        ]
                    },
                    "references": {
                        "read": [
                            "d19exr83"
                        ]
                    },
                    "samples": {
                        "read": [
                            "4eynwmic"
                        ]
                    },
                    "subtractions": {
                        "read": [
                            "0nhpi36p"
                        ]
                    }
                },
                "stage": "",
                "state": "complete",
                "status": [
                    {
                        "error": None,
                        "progress": 0,
                        "stage": None,
                        "state": "waiting",
                        "step_description": None,
                        "step_name": None,
                        "timestamp": "2022-07-08T18:37:44.936000Z"
                    },
                    {
                        "error": None,
                        "progress": 3,
                        "stage": None,
                        "state": "preparing",
                        "step_description": None,
                        "step_name": None,
                        "timestamp": "2022-07-08T18:41:20.647000Z"
                    },
                    {
                        "error": None,
                        "progress": 16,
                        "stage": "eliminate_otus",
                        "state": "running",
                        "step_description": "Map sample reads to reference OTUs and discard.",
                        "step_name": "Eliminate Otus",
                        "timestamp": "2022-07-08T18:48:11.287000Z"
                    },
                    {
                        "error": None,
                        "progress": 33,
                        "stage": "eliminate_subtraction",
                        "state": "running",
                        "step_description": "Map remaining reads to the subtraction and discard.",
                        "step_name": "Eliminate Subtraction",
                        "timestamp": "2022-07-08T19:00:24.291000Z"
                    },
                    {
                        "error": None,
                        "progress": 50,
                        "stage": "reunite_pairs",
                        "state": "running",
                        "step_description": "Reunite paired reads after elimination.",
                        "step_name": "Reunite Pairs",
                        "timestamp": "2022-07-08T19:02:53.618000Z"
                    },
                    {
                        "error": None,
                        "progress": 66,
                        "stage": "assemble",
                        "state": "running",
                        "step_description": "Assemble reads using SPAdes.",
                        "step_name": "Assemble",
                        "timestamp": "2022-07-08T19:02:53.644000Z"
                    },
                    {
                        "error": None,
                        "progress": 83,
                        "stage": "process_fasta",
                        "state": "running",
                        "step_description": "Find ORFs in the assembled contigs.",
                        "step_name": "Process Fasta",
                        "timestamp": "2022-07-08T19:07:22.352000Z"
                    },
                    {
                        "error": None,
                        "progress": 100,
                        "stage": "vfam",
                        "state": "running",
                        "step_description": "Search for viral motifs in ORF translations.",
                        "step_name": "Vfam",
                        "timestamp": "2022-07-08T19:07:44.531000Z"
                    },
                    {
                        "error": None,
                        "progress": 100,
                        "stage": "",
                        "state": "complete",
                        "step_description": None,
                        "step_name": None,
                        "timestamp": "2022-07-08T19:13:04.293000Z"
                    }
                ],
                "user": {
                    "administrator": False,
                    "handle": "jonathan",
                    "id": "88yksx67"
                },
                "workflow": "nuvs"
            }
        }
