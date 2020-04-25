import virtool.jobs.aodp
import virtool.jobs.build_index
import virtool.jobs.create_sample
import virtool.jobs.create_subtraction
import virtool.jobs.nuvs
import virtool.jobs.pathoscope
import virtool.jobs.update_sample

#: A dict containing :class:`~.job.Job` subclasses keyed by their task names.
TASK_CLASSES = {
    "aodp": virtool.jobs.aodp.Job,
    "build_index": virtool.jobs.build_index.Job,
    "create_subtraction": virtool.jobs.create_subtraction.Job,
    "create_sample": virtool.jobs.create_sample.Job,
    "nuvs": virtool.jobs.nuvs.Job,
    "pathoscope_bowtie": virtool.jobs.pathoscope.Job,
    "update_sample": virtool.jobs.update_sample.Job
}
