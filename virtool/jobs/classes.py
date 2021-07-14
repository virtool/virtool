import virtool.jobs.aodp
import virtool.jobs.create_sample
import virtool.jobs.pathoscope

TASK_CREATORS = {
    "aodp": virtool.jobs.aodp.create,
    "create_sample": virtool.jobs.create_sample.create,
    "pathoscope_bowtie": virtool.jobs.pathoscope.create,
}
