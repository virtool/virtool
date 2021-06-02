
from virtool.fake.factory import TestCaseDataFactory


async def populate(app):
    factory = TestCaseDataFactory(
        app, job_id="subtractions_integration_test_job")

    sample = await factory.sample(paired=True, finalized=True)

    sub1 = await factory.subtraction(finalize=True)
    sub2 = await factory.subtraction(finalize=True)
    subtraction_ids = [sub1["_id"], sub2["_id"]]

    analysis = await factory.analysis(
        index_id=None,
        ref_id=None,
        subtraction_ids=[sub1["_id"], sub2["_id"]],
        sample_id=sample["_id"]
    )

    await factory.job(workflow="subtractions_integration_test", args={
        "analysis_id": analysis["_id"],
        "sample_id": sample["_id"],
        "subtraction_id": subtraction_ids}
    )
