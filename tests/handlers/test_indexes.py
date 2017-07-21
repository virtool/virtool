class TestFind:

    async def test(self, spawn_client, static_time):
        client = await spawn_client()

        await client.db.indexes.insert_many([
            {
                "_id": "foo",
                "version": 0,
                "created_at": static_time,
                "virus_count": 231,
                "modification_count": 29,
                "modified_virus_count": 22,
                "ready": True,
                "has_files": True,
                "user": {
                    "id": "test"
                },
                "job": {
                    "id": "abh675"
                }
            },
            {
                "_id": "bar",
                "version": 1,
                "created_at": static_time,
                "virus_count": 232,
                "modification_count": 7,
                "modified_virus_count": 2,
                "ready": False,
                "has_files": True,
                "user": {
                    "id": "test"
                },
                "job": {
                    "id": "sj82la"
                }
            }
        ])

        resp = await client.get("/api/indexes")

        assert resp.status == 200

        assert await resp.json() == {
            "documents": [
                {
                    "created_at": "2017-10-06T20:00:00Z",
                    "has_files": True,
                    "id": "foo",
                    "job": {
                        "id": "abh675"
                    },
                    "modification_count": 29,
                    "modified_virus_count": 22,
                    "ready": True,
                    "user": {
                        "id": "test"
                    },
                    "version": 0,
                    "virus_count": 231
                },
                {
                    "created_at": "2017-10-06T20:00:00Z",
                    "has_files": True,
                    "id": "bar",
                    "job": {
                        "id": "sj82la"
                    },
                    "modification_count": 7,
                    "modified_virus_count": 2,
                    "ready": False,
                    "user": {
                        "id": "test"
                    },
                    "version": 1,
                    "virus_count": 232
                }
            ],
            "modified_virus_count": 0,
            "total_virus_count": 0
        }


class TestGet:

    async def test(self, spawn_client, static_time):
        client = await spawn_client()

        await client.db.indexes.insert_one({
            "_id": "foobar",
            "version": 0,
            "created_at": static_time,
            "virus_count": 232,
            "modification_count": 245,
            "modified_virus_count": 232,
            "ready": False,
            "has_files": True,
            "user": {
                "id": "test"
            },
            "job": {
                "id": "sj82la"
            }
        })

        await client.db.history.insert_many([
            {
                "_id": "zxbbvngc.0",
                "description": "Created Test (TS)",
                "virus": {
                    "version": 0,
                    "name": "Test",
                    "id": "zxbbvngc"
                },
                "created_at": static_time,
                "user": {
                    "id": "igboyes"
                },
                "diff": {
                    "last_indexed_version": None,
                    "lower_name": "test",
                    "isolates": [],
                    "abbreviation": "TS",
                    "version": 0,
                    "_id": "zxbbvngc",
                    "modified": True,
                    "name": "Test"
                },
                "method_name": "create",
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "zxbbvngc.1",
                "description": "Added isolate Isolate A as default",
                "virus": {
                    "version": 1,
                    "name": "Test",
                    "id": "zxbbvngc"
                },
                "created_at": static_time,
                "user": {
                    "id": "igboyes"
                },
                "diff": [
                    [
                        "change",
                        "version",
                        [
                            0,
                            1
                        ]
                    ],
                    [
                        "add",
                        "isolates",
                        [
                            [
                                0,
                                {
                                    "source_name": "A",
                                    "default": True,
                                    "id": "bn78cag5",
                                    "source_type": "isolate",
                                    "sequences": []
                                }
                            ]
                        ]
                    ]
                ],
                "method_name": "add_isolate",
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "test_1",
                "index": {
                    "id": "baz"
                }

            },
            {
                "_id": "test_2",
                "index": {
                    "id": "baz"
                }
            }
        ])

        resp = await client.get("/api/indexes/foobar")

        assert resp.status == 200

        assert await resp.json() == {
            "changes": [
                {
                    "created_at": "2017-10-06T20:00:00Z",
                    "description": "Created Test (TS)",
                    "id": "zxbbvngc.0",
                    "index": {
                        "id": "foobar",
                        "version": 0
                    },
                    "method_name": "create",
                    "user": {
                        "id": "igboyes"
                    },
                    "virus": {
                        "id": "zxbbvngc",
                        "name": "Test", "version": 0
                    }
                },
                {
                    "created_at": "2017-10-06T20:00:00Z",
                    "description": "Added isolate Isolate A as default",
                    "id": "zxbbvngc.1",
                    "index": {
                        "id": "foobar",
                        "version": 0
                    },
                    "method_name": "add_isolate",
                    "user": {
                        "id": "igboyes"
                    },
                    "virus": {
                        "id": "zxbbvngc",
                        "name": "Test",
                        "version": 1
                    }
                }
            ],
            "created_at": "2017-10-06T20:00:00Z",
            "has_files": True,
            "id": "foobar",
            "job": {
                "id": "sj82la"
            },
            "modification_count": 245,
            "modified_virus_count": 232,
            "ready": False,
            "user": {
                "id": "test"
            },
            "version": 0,
            "virus_count": 232
        }

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.get("/api/indexes/foobar")

        assert await resp_is.not_found(resp)
