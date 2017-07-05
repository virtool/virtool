import pytest

from virtool.organize import organize_samples


@pytest.fixture
def samples():
    return [
        {"_id": 1, "name": "sample 1"},
        {"_id": 2, "name": "sample 2"}
    ]


@pytest.fixture
def pathoscope_analyses():
    return [
        {"_id": 1, "ready": True, "sample": {"id": 1}, "algorithm": "pathoscope_bowtie"},
        {"_id": 2, "ready": False, "sample": {"id": 1}, "algorithm": "pathoscope_bowtie"},
        {"_id": 3, "ready": False, "sample": {"id": 2}, "algorithm": "pathoscope_bowtie"}
    ]


@pytest.fixture
def nuvs_analyses():
    return [
        {"_id": 1, "ready": True, "sample": {"id": 1}, "algorithm": "nuvs"},
        {"_id": 2, "ready": False, "sample": {"id": 1}, "algorithm": "nuvs"},
        {"_id": 3, "ready": False, "sample": {"id": 2}, "algorithm": "nuvs"}
    ]


class TestAddedCreatedAt:

    async def test(self, test_motor):
        await test_motor.samples.insert_many([
            {"_id": 1, "added": "now"},
            {"_id": 2, "created_at": "then"}
        ])

        await organize_samples(test_motor)

        print(await test_motor.samples.find().to_list(None))

        assert await test_motor.samples.find().to_list(None) == [
            {"pathoscope": False, "created_at": "now", "nuvs": False, "_id": 1},
            {"pathoscope": False, "created_at": "then", "nuvs": False, "_id": 2}
        ]



class TestBowtieTags:

    async def test_no_analyses(self, test_motor, samples, pathoscope_analyses):
        await test_motor.samples.insert_many(samples)

        pathoscope_analyses[2]["sample"]["id"] = 1

        await test_motor.analyses.insert_many(pathoscope_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["pathoscope"] is False

    async def test_bowtie_in_progress(self, test_motor, samples, pathoscope_analyses):
        await test_motor.samples.insert_many(samples)

        await test_motor.analyses.insert_many(pathoscope_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["pathoscope"] == "ip"

    async def test_bowtie_multi_in_progress(self, test_motor, samples, pathoscope_analyses):
        await test_motor.samples.insert_many(samples)

        pathoscope_analyses[1]["sample_id"] = 2

        await test_motor.analyses.insert_many(pathoscope_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["pathoscope"] == "ip"

    async def test_bowtie_one_ready(self, test_motor, samples, pathoscope_analyses):
        await test_motor.samples.insert_many(samples)

        pathoscope_analyses[2]["ready"] = True

        await test_motor.analyses.insert_many(pathoscope_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["pathoscope"] is True

    async def test_bowtie_multi_ready(self, test_motor, samples, pathoscope_analyses):
        await test_motor.samples.insert_many(samples)

        pathoscope_analyses[2].update({
            "ready": True,
            "sample_id": 2
        })

        pathoscope_analyses[2]["ready"] = True

        await test_motor.analyses.insert_many(pathoscope_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["pathoscope"] is True

    async def test_bowtie_mixed_ready(self, test_motor, samples, pathoscope_analyses):
        await test_motor.samples.insert_many(samples)

        pathoscope_analyses[2]["ready"] = True

        await test_motor.analyses.insert_many(pathoscope_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["pathoscope"] is True

    async def test_both_ready(self, test_motor, samples):
        await test_motor.samples.insert_many(samples)

        await test_motor.analyses.insert_many([
            {"_id": 1, "ready": True, "sample": {"id": 1}, "algorithm": "pathoscope_bowtie"},
            {"_id": 3, "ready": True, "sample": {"id": 2}, "algorithm": "pathoscope_bowtie"}
        ])

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["pathoscope"] is True


class TestNuVsTags:

    async def test_no_analyses(self, test_motor, samples, nuvs_analyses):
        await test_motor.samples.insert_many(samples)

        nuvs_analyses[2]["sample"]["id"] = 1

        await test_motor.analyses.insert_many(nuvs_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["nuvs"] is False

    async def test_one_in_progress(self, test_motor, samples, nuvs_analyses):
        await test_motor.samples.insert_many(samples)

        await test_motor.analyses.insert_many(nuvs_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["nuvs"] == "ip"

    async def test_multi_in_progress(self, test_motor, samples, nuvs_analyses):
        await test_motor.samples.insert_many(samples)

        nuvs_analyses[1]["sample"]["id"] = 2

        await test_motor.analyses.insert_many(nuvs_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["nuvs"] == "ip"

    async def test_one_ready(self, test_motor, samples, nuvs_analyses):
        await test_motor.samples.insert_many(samples)

        nuvs_analyses[1].update({
            "sample": {"id": 2},
            "ready": True
        })

        await test_motor.analyses.insert_many(nuvs_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["nuvs"] is True

    async def test_multi_ready(self, test_motor, samples, nuvs_analyses):
        await test_motor.samples.insert_many(samples)

        for i in [1, 2]:
            nuvs_analyses[i].update({
                "sample": {"id": 2},
                "ready": True
            })

        await test_motor.analyses.insert_many(nuvs_analyses)

        await organize_samples(test_motor)

        assert (await test_motor.samples.find_one(2))["nuvs"] is True
