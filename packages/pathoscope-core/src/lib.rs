pub mod candidates;
mod coverage;
mod em;
mod matrix;
mod sam;
pub mod subtraction;

use em::{compute_best_hit, em};
use log::info;
use serde::Serialize;
use thiserror::Error;

use rustc_hash::FxHashMap;

/// Unified error type for the pathoscope workflow
#[derive(Error, Debug)]
pub enum PathoscopeError {
    #[error("HTSlib error: {0}")]
    Htslib(#[from] rust_htslib::errors::Error),

    #[error("UTF-8 conversion error: {0}")]
    Utf8(#[from] std::str::Utf8Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("bowtie2 error: {0}")]
    Bowtie2(String),
}

use std::collections::HashSet;

use crate::coverage::calculate_coverage_from_bam;

// Type aliases for complex HashMap types used throughout the codebase
pub type UniqueReads = FxHashMap<i32, (i32, f64)>;
pub type MultiMappingReads = FxHashMap<i32, (Vec<i32>, Vec<f64>, Vec<f64>, f64)>;
pub type MatrixResult = (UniqueReads, MultiMappingReads, Vec<String>, Vec<String>);

/// The full result of an expectation-maximization run.
///
/// Serialized to the `em` subcommand's `--output` file. `coverage` is an
/// `FxHashMap` only as an implementation detail; it serializes as a plain
/// JSON object keyed by reference id.
#[derive(Clone, Serialize)]
pub struct PathoscopeResults {
    pub best_hit_initial_reads: Vec<f64>,
    pub best_hit_initial: Vec<f64>,
    pub level_1_initial: Vec<f64>,
    pub level_2_initial: Vec<f64>,
    pub best_hit_final_reads: Vec<f64>,
    pub best_hit_final: Vec<f64>,
    pub level_1_final: Vec<f64>,
    pub level_2_final: Vec<f64>,
    pub init_pi: Vec<f64>,
    pub pi: Vec<f64>,
    pub refs: Vec<String>,
    pub reads: Vec<String>,
    pub coverage: FxHashMap<String, Vec<usize>>,
}

/// Run expectation maximization algorithm
///
/// # Arguments
/// * `alignment_path` - Path to the SAM/BAM file
/// * `p_score_cutoff` - Minimum score threshold for alignments
pub fn run_expectation_maximization(
    alignment_path: &str,
    p_score_cutoff: f64,
) -> Result<PathoscopeResults, PathoscopeError> {
    info!(
        "starting em algorithm: file={}, cutoff={}",
        alignment_path, p_score_cutoff
    );

    let matrix = matrix::build_matrix(alignment_path, Some(p_score_cutoff))?;

    // Calculate initial best hit statistics using the matrix
    let initial_best_hit = compute_best_hit(&matrix);

    // Run EM algorithm using the matrix
    let em_results = em(&matrix, 50, 1e-7, 0.0, 0.0);

    // Calculate final best hit statistics using the updated matrix
    let final_best_hit = compute_best_hit(&em_results.updated_matrix);

    // Calculate coverage using the matrix
    let coverage = calculate_coverage_from_bam(
        alignment_path,
        &em_results.updated_matrix,
        p_score_cutoff,
    )?;

    Ok(PathoscopeResults {
        best_hit_initial_reads: initial_best_hit.best_hit_reads,
        best_hit_initial: initial_best_hit.best_hit,
        level_1_initial: initial_best_hit.level1,
        level_2_initial: initial_best_hit.level2,
        best_hit_final_reads: final_best_hit.best_hit_reads,
        best_hit_final: final_best_hit.best_hit,
        level_1_final: final_best_hit.level1,
        level_2_final: final_best_hit.level2,
        init_pi: em_results.init_pi,
        pi: em_results.pi,
        refs: matrix.refs,
        reads: matrix.reads,
        coverage,
    })
}

/// Extract candidate OTU reference IDs by running bowtie2 directly with streaming
pub fn find_candidate_otus_with_bowtie2(
    bowtie_index_path: &str,
    read_paths: Vec<String>,
    proc: u32,
    p_score_cutoff: f64,
) -> Result<HashSet<String>, PathoscopeError> {
    candidates::find_candidate_otus_with_bowtie2(
        bowtie_index_path,
        read_paths,
        proc,
        p_score_cutoff,
    )
}

/// Eliminate subtraction reads from BAM and filter the input FASTQ file.
///
/// # Arguments
/// * `isolate_alignment_path` - Path to the isolate SAM/BAM file
/// * `subtraction_alignment_path` - Path to the subtraction SAM/BAM file
/// * `output_alignment_path` - Path to write the filtered SAM/BAM file
/// * `input_fastq_path` - Path to the input FASTQ file to filter
/// * `output_fastq_path` - Path to write the filtered FASTQ file
/// * `proc` - Number of threads to use for processing
///
/// # Returns
/// Number of reads that were subtracted (eliminated)
pub fn run_eliminate_subtraction(
    isolate_alignment_path: &str,
    subtraction_alignment_path: &str,
    output_alignment_path: &str,
    input_fastq_path: &str,
    output_fastq_path: &str,
    proc: u32,
) -> Result<usize, PathoscopeError> {
    subtraction::eliminate_subtraction(
        isolate_alignment_path,
        subtraction_alignment_path,
        output_alignment_path,
        input_fastq_path,
        output_fastq_path,
        proc as usize,
    )
}

/// Tests
#[cfg(test)]
mod tests {
    #![allow(unused)]

    use crate::*;
    use std::fs::File;
    use std::io::BufRead;
    use std::io::BufReader;
    use std::io::Read;

    #[test]
    fn test_run_eliminate_subtraction() {
        use rust_htslib::{bam, bam::Read};
        use std::fs;
        use tempfile::TempDir;

        // Create temp directory for output
        let temp_dir = TempDir::new().unwrap();
        let output_bam_path = temp_dir.path().join("output.bam");
        let input_fastq_path = temp_dir.path().join("input.fastq");
        let output_fastq_path = temp_dir.path().join("output.fastq");

        // Create a minimal FASTQ file for testing
        std::fs::write(&input_fastq_path, "@read_keep\nACGT\n+\nIIII\n@read_eliminate\nACGT\n+\nIIII\n@read_unknown\nACGT\n+\nIIII\n@read_equal\nACGT\n+\nIIII\n").unwrap();

        // Run the pure Rust function directly
        let subtracted_count = subtraction::eliminate_subtraction(
            concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/tests/fixtures/test_isolates_minimal.sam"
            ),
            concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/tests/fixtures/test_subtraction_minimal.sam"
            ),
            output_bam_path.to_str().unwrap(),
            input_fastq_path.to_str().unwrap(),
            output_fastq_path.to_str().unwrap(),
            4,
        )
        .unwrap();

        // Read and verify output BAM
        let mut bam_reader = bam::Reader::from_path(&output_bam_path).unwrap();
        let header = bam_reader.header();

        // Verify headers are preserved
        assert!(
            header.target_count() > 0,
            "Sequence headers should be preserved"
        );

        // Collect read names from BAM output
        let mut read_names = Vec::with_capacity(10);
        let mut record = bam::Record::new();
        while let Some(result) = bam_reader.read(&mut record) {
            if result.is_ok() {
                if let Ok(qname) = std::str::from_utf8(record.qname()) {
                    read_names.push(qname.to_string());
                }
            } else {
                break;
            }
        }

        // Verify correct reads are kept
        assert!(
            read_names.contains(&"read_keep".to_string()),
            "Read with lower subtraction score should be kept"
        );
        assert!(
            read_names.contains(&"read_unknown".to_string()),
            "Read not in subtraction should be kept"
        );

        // Verify eliminated reads are not present
        assert!(
            !read_names.contains(&"read_eliminate".to_string()),
            "Read with higher subtraction score should be eliminated"
        );
        assert!(
            !read_names.contains(&"read_equal".to_string()),
            "Read with equal scores should be eliminated"
        );

        // Verify the return value - should be 2 (read_eliminate and read_equal)
        assert_eq!(
            subtracted_count, 2,
            "Should have subtracted 2 reads (read_eliminate and read_equal)"
        );

        // Verify FASTQ output - should only contain read_keep and read_unknown
        let fastq_output = fs::read_to_string(&output_fastq_path).unwrap();
        assert!(
            fastq_output.contains("@read_keep"),
            "FASTQ output should contain read_keep"
        );
        assert!(
            fastq_output.contains("@read_unknown"),
            "FASTQ output should contain read_unknown"
        );
        assert!(
            !fastq_output.contains("@read_eliminate"),
            "FASTQ output should not contain read_eliminate"
        );
        assert!(
            !fastq_output.contains("@read_equal"),
            "FASTQ output should not contain read_equal"
        );
    }
}
