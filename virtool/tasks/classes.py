import virtool.subtractions.db
import virtool.references.db
import virtool.software.db
import virtool.hmm.db

TASK_CLASSES = {
    "delete_reference": virtool.references.db.DeleteReferenceTask,
    "clone_reference": virtool.references.db.CloneReferenceTask,
    "import_reference": virtool.references.db.ImportReferenceTask,
    "remote_reference": virtool.references.db.RemoteReferenceTask,
    "update_remote_reference": virtool.references.db.UpdateRemoteReferenceTask,
    "update_software": virtool.software.db.SoftwareInstallTask,
    "install_hmms": virtool.hmm.db.HMMInstallTask,
    "write_subtraction_fasta": virtool.subtractions.db.WriteSubtractionFASTATask,
    "create_index_json": virtool.references.db.CreateIndexJSONTask
}
