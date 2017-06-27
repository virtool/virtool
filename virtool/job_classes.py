import virtool.subtraction
import virtool.virus_index
import virtool.sample
import virtool.job_analysis
import virtool.job_test


#: A dict containing :class:`~.job.Job` subclasses keyed by their task names.
TASK_CLASSES = {
    "rebuild_index": virtool.virus_index.RebuildIndex,
    "pathoscope_bowtie": virtool.job_analysis.PathoscopeBowtie,
    "nuvs": virtool.job_analysis.NuVs,
    "add_subtraction": virtool.subtraction.AddHost,
    "import_reads": virtool.sample.ImportReads,
    "test_task": virtool.job_test.TestTask
}
