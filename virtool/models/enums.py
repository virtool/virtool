from enum import Enum


class Molecule(str, Enum):
    ds_dna = "dsDNA"
    ds_rna = "dsRNA"
    ss_dna = "ssDNA"
    ss_rna = "ssRNA"
    ss_rna_neg = "ssRNA-"
    ss_rna_pos = "ssRNA+"


class Permission(str, Enum):
    cancel_job = "cancel_job"
    create_ref = "create_ref"
    create_sample = "create_sample"
    modify_hmm = "modify_hmm"
    modify_subtraction = "modify_subtraction"
    remove_file = "remove_file"
    remove_job = "remove_job"
    upload_file = "upload_file"


class HistoryMethod(str, Enum):
    add_isolate = "add_isolate"
    create = "create"
    create_sequence = "create_sequence"
    clone = "clone"
    edit = "edit"
    edit_sequence = "edit_sequence"
    edit_isolate = "edit_isolate"
    remove = "remove"
    remote = "remote"
    remove_isolate = "remove_isolate"
    remove_sequence = "remove_sequence"
    import_otu = "import"
    set_as_default = "set_as_default"
    update = "update"


class AnalysisWorkflow(str, Enum):
    aodp = "aodp"
    iimi = "iimi"
    nuvs = "nuvs"
    pathoscope_bowtie = "pathoscope_bowtie"


QuickAnalyzeWorkflow = AnalysisWorkflow


class LibraryType(str, Enum):
    amplicon = "amplicon"
    srna = "srna"
    other = "other"
    normal = "normal"


class ReferencePermission(str, Enum):
    build = "build"
    modify = "modify"
    modify_otu = "modify_otu"
    remove = "remove"


class MessageColor(str, Enum):
    red = "red"
    yellow = "yellow"
    blue = "blue"
    purple = "purple"
    orange = "orange"
    grey = "grey"
