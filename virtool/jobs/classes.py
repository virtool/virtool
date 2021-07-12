import virtool.jobs.aodp
import virtool.jobs.build_index
import virtool.jobs.create_sample
import virtool.jobs.nuvs
import virtool.jobs.pathoscope

TASK_CREATORS = {
    "aodp": virtool.jobs.aodp.create,
    "build_index": virtool.jobs.build_index.create,
    "create_sample": virtool.jobs.create_sample.create,
    "nuvs": virtool.jobs.nuvs.create,
    "pathoscope_bowtie": virtool.jobs.pathoscope.create,
}
