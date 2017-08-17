import virtool.subtraction
import virtool.virus_index
import virtool.sample_create
import virtool.job_analysis
import virtool.job_dummy


#: A dict containing :class:`~.job.Job` subclasses keyed by their task names.
TASK_CLASSES = {
    "rebuild_index": virtool.virus_index.RebuildIndex,
    "pathoscope_bowtie": virtool.job_analysis.PathoscopeBowtie,
    "nuvs": virtool.job_analysis.NuVs,
    "add_subtraction": virtool.subtraction.CreateSubtraction,
    "create_sample": virtool.sample_create.CreateSample,
    "dummy_job": virtool.job_dummy.DummyJob
}
