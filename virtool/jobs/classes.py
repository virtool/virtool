import virtool.jobs.aodp
import virtool.jobs.build_index
import virtool.jobs.create_sample
import virtool.jobs.create_subtraction
import virtool.jobs.nuvs
import virtool.jobs.pathoscope
import virtool.jobs.update_sample

TASK_OBJECTS = {
    "aodp": virtool.jobs.aodp.aodp_job,
    "build_index": virtool.jobs.build_index.build_index_job,
    "create_subtraction": virtool.jobs.create_subtraction.create_subtraction_job,
    "create_sample": virtool.jobs.create_sample.create_sample_job,
    "nuvs": virtool.jobs.nuvs.nuvs_job,
    "pathoscope_bowtie": virtool.jobs.pathoscope.pathoscope_job,
    "update_sample": virtool.jobs.update_sample.update_sample_job
}
