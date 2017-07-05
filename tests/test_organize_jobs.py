from operator import itemgetter

import virtool.organize


class TestOrganizeJobs:

    async def test_unset_archived(self, test_motor):
        await test_motor.jobs.insert_many([
            {
                "_id": 1,
                "archived": False
            },
            {
                "_id": 2,
                "archived": True
            },
            {
                "_id": 3
            }
        ])

        await virtool.organize.organize_jobs(test_motor)

        assert await test_motor.jobs.find(sort=[("_id", 1)]).to_list(None) == sorted([
            {
                "_id": 1
            },
            {
                "_id": 2
            },
            {
                "_id": 3
            }
        ], key=itemgetter("_id"))
