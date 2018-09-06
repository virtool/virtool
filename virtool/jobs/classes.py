import virtool.jobs.build_index
import virtool.jobs.create_sample
import virtool.jobs.create_subtraction
import virtool.jobs.nuvs
import virtool.jobs.pathoscope

#: A dict containing :class:`~.job.Job` subclasses keyed by their task names.
TASK_CLASSES = {
    "build_index": virtool.jobs.build_index.Job,
    "pathoscope_bowtie": virtool.jobs.pathoscope.Job,
    "nuvs": virtool.jobs.nuvs.Job,
    "create_subtraction": virtool.jobs.create_subtraction.Job,
    "create_sample": virtool.jobs.create_sample.Job
}
