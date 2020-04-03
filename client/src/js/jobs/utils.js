import { get, startCase } from "lodash-es";

const importResultsDescription = {
    title: "Save Results",
    description: "Annotate the results and save them in the database."
};

const makeAnalysisDirDescription = {
    title: "Create Directory",
    description: "Create a directory where the job will run and analysis files will be stored."
};

const prepareReadsDescription = {
    title: "Prepare Reads",
    description: "Get existing trimmed data or create a cache."
};

const prepareQCDescription = {
    title: "Check QC",
    description: "Run FastQC if a new cache was created."
};

const aodpDescriptions = {
    make_analysis_dir: makeAnalysisDirDescription,
    prepare_reads: prepareReadsDescription,
    join_reads: {
        title: "Join Reads",
        description: "Join paired end reads into single long reads."
    },
    deduplicate_reads: {
        title: "Deduplicate Reads",
        description: "Remove duplicate reads and quantify duplication."
    },
    prepare_index: {
        title: "Prepare Index",
        description: "Prepare the reference index for searching."
    },
    aodp: {
        title: "AODP",
        description: "Run AODP using the amplicon and reference data."
    },
    import_results: importResultsDescription
};

const buildIndexDescriptions = {
    mk_index_dir: {
        title: "Create Directory",
        description: "Create data directory to store the new Bowtie2 index in."
    },
    write_fasta: {
        title: "Generate OTU FASTA",
        description: "Generate a FASTA file containing sequences for all default OTU isolates."
    },
    bowtie_build: {
        title: "Bowtie Build",
        description: "Build a Bowtie2 index from the FASTA file generated in the previous step."
    },
    replace_old: {
        title: "Replace Previous",
        description: "Make the new build the active index for the reference."
    }
};

const createSampleDescriptions = {
    make_sample_dir: {
        title: "Create Directory",
        description: "Create a data directory for the new sample."
    },
    copy_files: {
        title: "Copy Files",
        description: "Copy and compress input FASTQ files."
    },
    fastqc: {
        title: "FastQC",
        description: "Run FastQC on the sample FASTQ files."
    },
    parse_fastqc: {
        title: "Parse FastQC",
        description: "Parse FastQC output and store in database."
    },
    clean_watch: {
        title: "Cleanup",
        description: "Remove the source files."
    }
};

const createSubtractionDescriptions = {
    make_subtraction_dir: {
        title: "Create Directory",
        description: "Create a data directory for the new subtraction."
    },
    unpack: {
        title: "Unpack",
        description: "Decompress the sequence file if necessary."
    },
    set_stats: {
        title: "Save Sequence Statistics",
        description: "Save the GC content and sequence count to the database."
    },
    bowtie_build: {
        title: "Bowtie Build",
        description: "Build a Bowtie2 index from the FASTA file provided by the user."
    },
    compress: {
        title: "Compress FASTA",
        description: "Compress the FASTA data for long-term storage."
    }
};

const pathoscopeBowtieDescriptions = {
    make_analysis_dir: makeAnalysisDirDescription,
    prepare_reads: prepareReadsDescription,
    prepare_qc: prepareQCDescription,
    map_default_isolates: {
        title: "Map to Default Isolates",
        description: "Map the sequences of all OTU default isolates."
    },
    generate_isolate_fasta: {
        title: "Write Isolate FASTA",
        description: "Create a FASTA file containing all sequences of OTUs detected in previous step."
    },
    build_isolate_index: {
        title: "Build Isolate Index",
        description: "Build a Bowtie2 index from the all-isolate FASTA generated in the previous step."
    },
    map_isolates: {
        title: "Map to Isolates",
        description: "Map to the all-isolate index."
    },
    map_subtraction: {
        title: "Map to Subtraction",
        description: "Map all reads mapped in the previous step to the subtraction."
    },
    subtract_mapping: {
        title: "Subtract Reads",
        description: "Remove reads that have a better alignment against the subtraction than an OTU."
    },
    pathoscope: {
        title: "Pathoscope",
        description: "Reassign ambiguous mappings using Pathoscope 2.0."
    },
    import_results: importResultsDescription,
    cleanup_indexes: {
        title: "Clean-up Indexes",
        description: "Prune stale OTU indexes if they are no longer being used."
    }
};

const nuvsDescriptions = {
    make_analysis_dir: makeAnalysisDirDescription,
    prepare_reads: prepareReadsDescription,
    prepare_qc: prepareQCDescription,
    eliminate_otus: {
        title: "Eliminate OTUs",
        description: "Map against the OTU index and eliminate reads that match."
    },
    eliminate_subtraction: {
        title: "Eliminate Subtraction",
        description: "Map against the subtraction index and eliminate reads that match."
    },
    reunite_pairs: {
        title: "Reunite Pairs",
        description: "Ensure all remaining read pairs are paired correctly after subtraction."
    },
    assemble: {
        title: "Assemble",
        description: "Assemble contigs from remaining reads using SPAdes."
    },
    process_fasta: {
        title: "Process Assembly",
        description: "Find significant open reading frames (ORFs) in the assembled contigs."
    },
    prepare_hmm: {
        title: "Prepare HMM Profiles",
        description: "Run hmmpress on profiles in preparation for running hmmscan."
    },
    vfam: {
        title: "VFam",
        description: "Use hmmscan and vfam profiles to find viral motifs in the assembled contigs."
    },
    import_results: importResultsDescription
};

const updateSampleDescriptions = {
    copy_files: {
        title: "Copy Files",
        description: "Copy and compress replacement FASTQ files."
    },
    fastqc: {
        title: "FastQC",
        description: "Run FastQC on the replacement FASTQ files."
    },
    parse_fastqc: {
        title: "Parse FastQC",
        description: "Parse FastQC output and store in database."
    },
    create_cache: {
        title: "Create Cache",
        description: "Create a trim cache from the original trimmed files."
    }
};

export const stepDescriptions = {
    aodp: aodpDescriptions,
    build_index: buildIndexDescriptions,
    create_sample: createSampleDescriptions,
    create_subtraction: createSubtractionDescriptions,
    pathoscope_bowtie: pathoscopeBowtieDescriptions,
    nuvs: nuvsDescriptions,
    update_sample: updateSampleDescriptions
};

export const getStepDescription = (stage, state, task) => {
    if (state === "waiting") {
        return {
            title: "Waiting",
            description: "Waiting for resources to become available."
        };
    }

    if (state === "complete") {
        return {
            title: "Complete",
            description: ""
        };
    }

    if (state === "cancelled") {
        return {
            title: "Cancelled",
            description: ""
        };
    }

    return get(stepDescriptions, [task, stage], {
        description: "",
        title: startCase(stage)
    });
};
