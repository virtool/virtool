import virtool.subtraction
import virtool.indexes
import virtool.sample_create
import virtool.sample_analysis
import virtool.job_dummy


#: A dict containing :class:`~.job.Job` subclasses keyed by their task names.
TASK_CLASSES = {
    "rebuild_index": virtool.indexes.RebuildIndex,
    "pathoscope_bowtie": virtool.sample_analysis.PathoscopeBowtie,
    "nuvs": virtool.sample_analysis.NuVs,
    "create_subtraction": virtool.subtraction.CreateSubtraction,
    "create_sample": virtool.sample_create.CreateSample,
    "dummy": virtool.job_dummy.DummyJob
}
