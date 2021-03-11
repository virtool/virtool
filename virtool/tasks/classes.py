import virtool.analyses.db
import virtool.uploads.db
import virtool.hmm.db
import virtool.software.db
import virtool.subtractions.db
import virtool.references.db

TASK_CLASSES = {
    "delete_reference": virtool.references.db.DeleteReferenceTask,
    "clone_reference": virtool.references.db.CloneReferenceTask,
    "import_reference": virtool.references.db.ImportReferenceTask,
    "remote_reference": virtool.references.db.RemoteReferenceTask,
    "update_remote_reference": virtool.references.db.UpdateRemoteReferenceTask,
    "update_software": virtool.software.db.SoftwareInstallTask,
    "install_hmms": virtool.hmm.db.HMMInstallTask,
    "write_subtraction_fasta": virtool.subtractions.db.WriteSubtractionFASTATask,
    "create_index_json": virtool.references.db.CreateIndexJSONTask,
    "add_subtraction_files": virtool.subtractions.db.AddSubtractionFilesTask,
    "store_nuvs_file_task": virtool.analyses.db.StoreNuvsFilesTask,
    "migrate_files": virtool.uploads.db.MigrateFilesTask
}
