import virtool.jobs.aodp
import virtool.jobs.nuvs
import virtool.jobs.pathoscope

TASK_CREATORS = {
    "aodp": virtool.jobs.aodp.create,
    "nuvs": virtool.jobs.nuvs.create,
    "pathoscope_bowtie": virtool.jobs.pathoscope.create,
}
