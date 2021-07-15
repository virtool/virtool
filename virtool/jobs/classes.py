import virtool.jobs.nuvs
import virtool.jobs.pathoscope

TASK_CREATORS = {
    "nuvs": virtool.jobs.nuvs.create,
    "pathoscope_bowtie": virtool.jobs.pathoscope.create,
}
