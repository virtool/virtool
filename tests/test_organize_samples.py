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
        {"_id": 1, "ready": True, "sample_id": 1, "algorithm": "pathoscope_bowtie"},
        {"_id": 2, "ready": False, "sample_id": 1, "algorithm": "pathoscope_bowtie"},
        {"_id": 3, "ready": False, "sample_id": 2, "algorithm": "pathoscope_bowtie"}
    ]


@pytest.fixture
def nuvs_analyses():
    return [
        {"_id": 1, "ready": True, "sample_id": 1, "algorithm": "nuvs"},
        {"_id": 2, "ready": False, "sample_id": 1, "algorithm": "nuvs"},
        {"_id": 3, "ready": False, "sample_id": 2, "algorithm": "nuvs"}
    ]


class TestBowtieTags:

    def test_no_analyses(self, test_db, samples, pathoscope_analyses):
        test_db.samples.insert_many(samples)

        pathoscope_analyses[2]["sample_id"] = 1

        test_db.analyses.insert_many(pathoscope_analyses)

        organize_samples(test_db)

        sample_two = test_db.samples.find_one(2)

        assert sample_two["pathoscope"] is False

    def test_bowtie_in_progress(self, test_db, samples, pathoscope_analyses):
        test_db.samples.insert_many(samples)

        test_db.analyses.insert_many(pathoscope_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["pathoscope"] == "ip"

    def test_bowtie_multi_in_progress(self, test_db, samples, pathoscope_analyses):
        test_db.samples.insert_many(samples)

        pathoscope_analyses[1]["sample_id"] = 2

        test_db.analyses.insert_many(pathoscope_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["pathoscope"] == "ip"

    def test_bowtie_one_ready(self, test_db, samples, pathoscope_analyses):
        test_db.samples.insert_many(samples)

        pathoscope_analyses[2]["ready"] = True

        test_db.analyses.insert_many(pathoscope_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["pathoscope"] is True

    def test_bowtie_multi_ready(self, test_db, samples, pathoscope_analyses):
        test_db.samples.insert_many(samples)

        pathoscope_analyses[2].update({
            "ready": True,
            "sample_id": 2
        })

        pathoscope_analyses[2]["ready"] = True

        test_db.analyses.insert_many(pathoscope_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["pathoscope"] is True

    def test_bowtie_mixed_ready(self, test_db, samples, pathoscope_analyses):
        test_db.samples.insert_many(samples)

        pathoscope_analyses[2]["ready"] = True

        test_db.analyses.insert_many(pathoscope_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["pathoscope"] is True

    def test_both_ready(self, test_db, samples, pathoscope_analyses):
        test_db.samples.insert_many(samples)

        test_db.analyses.insert_many([
            {"_id": 1, "ready": True, "sample_id": 1, "algorithm": "pathoscope_bowtie"},
            {"_id": 3, "ready": True, "sample_id": 2, "algorithm": "pathoscope_bowtie"}
        ])

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["pathoscope"] is True


class TestNuVsTags:

    def test_no_analyses(self, test_db, samples, nuvs_analyses):
        test_db.samples.insert_many(samples)

        nuvs_analyses[2]["sample_id"] = 1

        test_db.analyses.insert_many(nuvs_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["nuvs"] is False

    def test_one_in_progress(self, test_db, samples, nuvs_analyses):
        test_db.samples.insert_many(samples)

        test_db.analyses.insert_many(nuvs_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["nuvs"] == "ip"

    def test_multi_in_progress(self, test_db, samples, nuvs_analyses):
        test_db.samples.insert_many(samples)

        nuvs_analyses[1]["sample_id"] = 2

        test_db.analyses.insert_many(nuvs_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["nuvs"] == "ip"

    def test_one_ready(self, test_db, samples, nuvs_analyses):
        test_db.samples.insert_many(samples)

        nuvs_analyses[1].update({
            "sample_id": 2,
            "ready": True
        })

        test_db.analyses.insert_many(nuvs_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["nuvs"] is True

    def test_multi_ready(self, test_db, samples, nuvs_analyses):
        test_db.samples.insert_many(samples)

        for i in [1, 2]:
            nuvs_analyses[i].update({
                "sample_id": 2,
                "ready": True
            })

        test_db.analyses.insert_many(nuvs_analyses)

        organize_samples(test_db)

        assert test_db.samples.find_one(2)["nuvs"] is True
