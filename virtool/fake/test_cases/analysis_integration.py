from virtool.fake.factory import TestCaseDataFactory
from virtool.fake.identifiers import USER_ID


async def populate(app):
    factory = TestCaseDataFactory(app, USER_ID, "analysis_integration_test_job")

    sample = await factory.sample(paired=True, finalized=True)

    analysis = await factory.analysis(
        index_id=None,
        ref_id=None,
        subtraction_ids=[],
        sample_id=sample["_id"]
    )

    await factory.job(workflow="analysis_integration_test", args={
        "analysis_id": analysis["_id"],
        "sample_id": sample["_id"]
    })
