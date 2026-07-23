from dataclasses import dataclass
from pathlib import Path

import pytest
from pydantic_factories import ModelFactory, Use

from virtool.analyses.models import Analysis, AnalysisSample
from virtool.indexes.models import Index, IndexNested
from virtool.jobs.models import JobMinimal, JobStep, JobWithKey
from virtool.quality.models import Quality
from virtool.references.models import Reference, ReferenceNested
from virtool.samples.models import Sample
from virtool.subtractions.models import Subtraction, SubtractionFile, SubtractionNested
from virtool.uploads.models import UploadMinimal
from virtool.workflow.pytest_plugin.utils import SUBTRACTION_FILENAMES, StaticTime


@dataclass
class WorkflowData:
    analysis: Analysis
    """An analysis being populated in the active workflow."""

    index: Index
    """A finalized index to be used for testing analyses."""

    job: JobWithKey
    """A fake job."""

    acquired: bool
    """Whether the fake job has been claimed."""

    reference: Reference
    """A reference to be used for testing analyses and index creation workflows."""

    sample: Sample
    """A finalized sample to be used for testing analyses."""

    new_sample: Sample
    """An un-finalized sample for testing sample creation workflows."""

    subtraction: Subtraction
    """A finalized subtraction to be used for testing analyses."""

    new_subtraction: Subtraction
    """An un-finalized subtraction for testing subtraction creation workflows."""

    step_start_updates: list[dict]
    """Step start updates pushed during the workflow, for test assertions."""

    finish_called: bool
    """Whether the workflow runtime called the finish endpoint."""


@pytest.fixture
def workflow_data(
    example_path: Path,
    static_time: StaticTime,
) -> WorkflowData:
    class AnalysisFactory(ModelFactory):
        __model__ = Analysis

        created_at = Use(lambda: static_time.datetime)
        updated_at = Use(lambda: static_time.datetime)

    class IndexFactory(ModelFactory[Index]):
        __model__ = Index

        created_at = Use(lambda: static_time.datetime)

    IndexFactory.seed_random(12)

    class JobFactory(ModelFactory):
        __model__ = JobWithKey

        claimed_at = Use(lambda: static_time.datetime)
        created_at = Use(lambda: static_time.datetime)
        pinged_at = Use(lambda: static_time.datetime)
        timestamp = Use(lambda: static_time.datetime)

    JobFactory.seed_random(55)

    class ReferenceFactory(ModelFactory):
        __model__ = Reference

        created_at = Use(lambda: static_time.datetime)

    ReferenceFactory.seed_random(22)

    class SampleFactory(ModelFactory):
        __model__ = Sample

        created_at = Use(lambda: static_time.datetime)
        removed_at = None
        uploaded_at = Use(lambda: static_time.datetime)

    SampleFactory.seed_random(5)

    class SubtractionFactory(ModelFactory):
        __model__ = Subtraction

        created_at = Use(lambda: static_time.datetime)

    job: JobWithKey = JobFactory.build()

    job.id = 1
    job.args = {
        "item_id": 1211,
        "resource_id": "foo",
        "test": True,
    }
    job.pinged_at = static_time.datetime
    job.key = "test_key"
    job.steps = [
        JobStep(
            description="SbXerFVrWCqqjehJZicZ",
            id="psihdpFaJrqQyqzKcYbM",
            name="RaOtEacjXkNWWrsBOfMP",
            started_at=static_time.datetime,
        ),
    ]

    """A finalized sample to be used for testing analyses."""
    sample = SampleFactory.build()
    sample.job = JobMinimal.parse_obj(job)
    sample.artifacts = []
    sample.quality = Quality(
        bases=[],
        composition=[],
        count=0,
        encoding="",
        gc=0,
        length=[0, 0],
        sequences=[],
    )
    sample.ready = True

    # A new sample with the fake job configured as the creation job for the sample.
    new_sample = SampleFactory.build()

    new_sample_job = JobFactory.build()
    new_sample_job.args["sample_id"] = new_sample.id

    new_sample.artifacts = []
    new_sample.job = JobMinimal.parse_obj(new_sample_job)
    new_sample.uploads = [
        UploadMinimal(
            id=1,
            created_at=static_time.datetime,
            name="reads_1.fq.gz",
            ready=True,
            removed=False,
            removed_at=None,
            reserved=True,
            size=100,
            type="reads",
            uploaded_at=static_time.datetime,
            user=new_sample.user,
        ),
        UploadMinimal(
            id=2,
            created_at=static_time.datetime,
            name="reads_2.fq.gz",
            ready=True,
            removed=False,
            removed_at=None,
            reserved=True,
            size=100,
            type="reads",
            uploaded_at=static_time.datetime,
            user=new_sample.user,
        ),
    ]
    new_sample.quality = None
    new_sample.reads = []
    new_sample.ready = False

    reference = ReferenceFactory.build()

    index = IndexFactory.build()
    index.files = []
    index.reference = ReferenceNested.parse_obj(reference)
    index.ready = True

    subtraction = SubtractionFactory.build()
    subtraction.files = [
        SubtractionFile(
            download_url=f"/subtractions/{subtraction.id}/files/{filename}",
            id=(i + 1),
            name=filename,
            size=(example_path / "subtractions" / "arabidopsis_thaliana" / filename)
            .stat()
            .st_size,
            subtraction=subtraction.id,
            type="bowtie2",
        )
        for i, filename in enumerate(SUBTRACTION_FILENAMES)
    ]

    new_subtraction = SubtractionFactory.build()
    new_subtraction.files = []
    new_subtraction.ready = False

    analysis: Analysis = AnalysisFactory.build()
    analysis.sample = AnalysisSample.parse_obj(sample)
    analysis.workflow = "pathoscope"
    analysis.index = IndexNested.parse_obj(index)
    analysis.reference = ReferenceNested.parse_obj(reference)
    analysis.subtractions = [SubtractionNested.parse_obj(subtraction)]

    return WorkflowData(
        analysis=analysis,
        index=index,
        job=job,
        acquired=False,
        reference=reference,
        sample=sample,
        new_sample=new_sample,
        subtraction=subtraction,
        new_subtraction=new_subtraction,
        step_start_updates=[],
        finish_called=False,
    )
