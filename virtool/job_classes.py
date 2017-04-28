import virtool.host
import virtool.virus_index
import virtool.sample
import virtool.job_analysis


#: A dict containing :class:`~.job.Job` subclasses keyed by their task names.
TASK_CLASSES = {
    "rebuild_index": virtool.virus_index.RebuildIndex,
    "pathoscope_bowtie": virtool.job_analysis.PathoscopeBowtie,
    "pathoscope_snap": virtool.job_analysis.PathoscopeSNAP,
    "nuvs": virtool.job_analysis.NuVs,
    "add_host": virtool.host.AddHost,
    "import_reads": virtool.sample.ImportReads
}
