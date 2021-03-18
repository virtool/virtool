from virtool.analyses.db import StoreNuvsFilesTask
from virtool.hmm.db import HMMInstallTask
from virtool.references.db import CloneReferenceTask, CreateIndexJSONTask, DeleteReferenceTask, \
    ImportReferenceTask, RemoteReferenceTask, UpdateRemoteReferenceTask
from virtool.samples.db import CompressSamplesTask
from virtool.software.db import SoftwareInstallTask
from virtool.subtractions.db import AddSubtractionFilesTask, WriteSubtractionFASTATask
from virtool.uploads.db import MigrateFilesTask

TASK_CLASSES = {
    "add_subtraction_files": AddSubtractionFilesTask,
    "clone_reference": CloneReferenceTask,
    "compress_samples": CompressSamplesTask,
    "create_index_json": CreateIndexJSONTask,
    "delete_reference": DeleteReferenceTask,
    "import_reference": ImportReferenceTask,
    "install_hmms": HMMInstallTask,
    "migrate_files": MigrateFilesTask,
    "remote_reference": RemoteReferenceTask,
    "store_nuvs_file_task": StoreNuvsFilesTask,
    "update_remote_reference": UpdateRemoteReferenceTask,
    "update_software": SoftwareInstallTask,
    "write_subtraction_fasta": WriteSubtractionFASTATask
}
