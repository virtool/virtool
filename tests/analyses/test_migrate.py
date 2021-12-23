from virtool.analyses.migrate import nest_results


async def test_nest_pathoscope_results(snapshot, dbi):
    await dbi.analyses.insert_many(
        [
            {
                "_id": "foo",
                "read_count": 1209,
                "results": [1, 2, 3, 4, 5],
                "subtracted_count": 231,
                "workflow": "pathoscope_bowtie",
            },
            {
                "_id": "fine",
                "results": {
                    "hits": [1, 2, 3, 4, 5],
                    "read_count": 1209,
                    "subtracted_count": 231,
                },
                "workflow": "pathoscope_bowtie",
            },
            {
                "_id": "bar",
                "read_count": 7982,
                "results": [9, 8, 7, 6, 5],
                "subtracted_count": 112,
                "workflow": "pathoscope_bowtie",
            },
            {
                "_id": "baz",
                "results": [9, 8, 7, 6, 5],
                "workflow": "nuvs",
            },
            {
                "_id": "bad",
                "join_histogram": [1, 2, 3, 4, 5],
                "joined_pair_count": 12345,
                "remainder_pair_count": 54321,
                "results": [9, 8, 7, 6, 5],
                "workflow": "aodp",
            },
        ]
    )

    await nest_results(dbi)

    assert await dbi.analyses.find().to_list(None) == snapshot
