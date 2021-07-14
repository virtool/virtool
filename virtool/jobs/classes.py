import virtool.jobs.aodp
import virtool.jobs.pathoscope

TASK_CREATORS = {
    "aodp": virtool.jobs.aodp.create,
    "pathoscope_bowtie": virtool.jobs.pathoscope.create,
}
