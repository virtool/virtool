import virtool.jobs.aodp
import virtool.jobs.create_sample
import virtool.jobs.create_subtraction
import virtool.jobs.nuvs
import virtool.jobs.pathoscope

TASK_CREATORS = {
    "aodp": virtool.jobs.aodp.create,
    "create_subtraction": virtool.jobs.create_subtraction.create,
    "create_sample": virtool.jobs.create_sample.create,
    "nuvs": virtool.jobs.nuvs.create,
    "pathoscope_bowtie": virtool.jobs.pathoscope.create,
}
