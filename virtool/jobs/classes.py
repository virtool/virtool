from virtool.nuvs import job as nuvs
from virtool.pathoscope import job as pathoscope

import virtool.jobs.build_index
import virtool.jobs.create_sample
import virtool.jobs.create_subtraction

#: A dict containing :class:`~.job.Job` subclasses keyed by their task names.
TASK_CLASSES = {
    "build_index": virtool.jobs.build_index.BuildIndex,
    "pathoscope_bowtie": pathoscope.Job,
    "nuvs": nuvs.Job,
    "create_subtraction": virtool.jobs.create_subtraction.CreateSubtraction,
    "create_sample": virtool.jobs.create_sample.CreateSample
}
