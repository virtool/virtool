from virtool.fake.factory import load_test_case_from_yml

async def test_load_yml(app, run_in_thread, test_files_path):
    app["run_in_thread"] = run_in_thread
    case = await load_test_case_from_yml(app, test_files_path/"fake/test_case.yml")

    assert case.analysis.ready == False
    assert case.analysis._id == case.job.args["analysis_id"]
    assert case.analysis.sample["id"] == case.sample._id
    assert case.analysis.index["id"] == case.index._id
    assert case.analysis.reference["id"] == case.reference._id
    assert case.sample._id == case.job.args["sample_id"]
    assert case.index._id == case.job.args["index_id"]
    assert case.reference._id == case.job.args["ref_id"]

    for actual, expected in zip(case.subtractions, case.job.args["subtraction_ids"]):
        assert actual._id == expected

    assert case.job.args["additional_arg"] is True