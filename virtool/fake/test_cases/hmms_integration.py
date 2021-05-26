
from virtool.fake.factory import TestCaseDataFactory


async def populate(app):
    name = "hmms_integration_test"
    factory = TestCaseDataFactory(app, job_id=f"{name}_job")

    sample = await factory.sample(paired=True, finalized=True)
    analysis = await factory.analysis(workflow=name, sample_id=sample["_id"])
    await factory.hmms()
    await factory.job(workflow=name, args={
        "analysis_id": analysis["_id"],
    })

    return factory
