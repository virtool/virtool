import virtool.jobs.build_index
import virtool.jobs.analysis
import virtool.jobs.create_sample
import virtool.jobs.create_subtraction
import virtool.jobs.dummy

#: A dict containing :class:`~.job.Job` subclasses keyed by their task names.
TASK_CLASSES = {
    "build_index": virtool.jobs.build_index.BuildIndex,
    "pathoscope_bowtie": virtool.jobs.analysis.PathoscopeBowtie,
    "nuvs": virtool.jobs.analysis.NuVs,
    "create_subtraction": virtool.jobs.create_subtraction.CreateSubtraction,
    "create_sample": virtool.jobs.create_sample.CreateSample,
    "dummy": virtool.jobs.dummy.DummyJob
}
