use crate::sam::{extract_alignment_score, SamReader, CHUNK_SIZE};
use crate::PathoscopeError;
use log::info;
use rust_htslib::bam;
use rust_htslib::bam::Format;
use rustc_hash::FxHashMap;
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};

#[derive(Debug, Clone)]
pub struct SubtractionProcessor {
    subtraction_scores: FxHashMap<String, f32>,
}

impl SubtractionProcessor {
    /// Creates a new SubtractionProcessor with the given subtraction scores
    pub fn new(subtraction_scores: FxHashMap<String, f32>) -> Self {
        Self { subtraction_scores }
    }

    /// Check if a read should be eliminated based on its isolate score vs subtraction score
    pub fn should_eliminate(&self, read_id: &str, isolate_score: f32) -> bool {
        match self.subtraction_scores.get(read_id) {
            Some(subtraction_score) => subtraction_score >= &isolate_score,
            None => false,
        }
    }
}

/// Parse subtraction BAM file and return a map of read IDs to scores.
pub fn parse_subtraction_scores_from_bam(
    path: &str,
) -> Result<FxHashMap<String, f32>, PathoscopeError> {
    info!("parsing subtraction bam file: {}", path);

    let mut reader = SamReader::new(path)?;

    // Pre-allocate HashMap with estimated capacity
    let mut high_scores: FxHashMap<String, f32> =
        FxHashMap::with_capacity_and_hasher(100_000, Default::default());

    reader.stream_chunks(|chunk| {
        for record in chunk {
            // Skip unmapped reads
            if record.is_unmapped() {
                continue;
            }

            // Get read ID
            let read_id = std::str::from_utf8(record.qname())?.to_string();

            // Get alignment score
            if let Some(total_score) = extract_alignment_score(record) {
                high_scores.insert(read_id, total_score as f32);
            }
        }
        Ok(())
    })?;

    info!(
        "parsed {} subtraction scores from {}",
        high_scores.len(),
        path
    );
    Ok(high_scores)
}

/// Eliminate subtraction-mapped reads.
///
/// Processes isolate and subtraction SAM files to eliminate reads based on subtraction scores.
/// Creates both filtered SAM output, subtracted read IDs file, and filters FASTQ.
///
/// # Arguments
/// * `isolate_sam_path` - Path to the isolate SAM/BAM file
/// * `subtraction_sam_path` - Path to the subtraction SAM file  
/// * `output_sam_path` - Path to write the filtered SAM/BAM file
/// * `input_fastq_path` - Path to the input FASTQ file to filter
/// * `output_fastq_path` - Path to write the filtered FASTQ file
/// * `proc` - Number of threads to use for processing
///
/// # Returns
/// Number of reads that were subtracted (eliminated)
pub fn eliminate_subtraction(
    isolate_sam_path: &str,
    subtraction_sam_path: &str,
    output_sam_path: &str,
    input_fastq_path: &str,
    output_fastq_path: &str,
    proc: usize,
) -> Result<usize, PathoscopeError> {
    info!("starting subtraction elimination: isolate={}, subtraction={}, output={}, proc={}",
          isolate_sam_path, subtraction_sam_path, output_sam_path, proc);

    // Parse subtraction scores
    let subtraction_scores = parse_subtraction_scores_from_bam(subtraction_sam_path)?;
    let processor = SubtractionProcessor::new(subtraction_scores);

    // Process isolate file
    let subtracted_ids =
        process_isolate_file(isolate_sam_path, output_sam_path, &processor, proc)?;
    let subtracted_count = subtracted_ids.len();

    // Filter FASTQ file using the subtracted read IDs
    filter_fastq_file(input_fastq_path, output_fastq_path, &subtracted_ids)?;

    info!(
        "subtraction complete: {} reads eliminated",
        subtracted_count
    );
    Ok(subtracted_count)
}

/// Process the isolate SAM file and write filtered output using rust-htslib
pub fn process_isolate_file(
    input_path: &str,
    output_path: &str,
    processor: &SubtractionProcessor,
    proc: usize,
) -> Result<HashSet<String>, PathoscopeError> {
    let mut reader = SamReader::new(input_path)
        .map_err(|_| PathoscopeError::Parse("Failed to open SAM file".to_string()))?;

    // Get the header from input to preserve SQ lines and other headers
    let header_view = reader.header().clone();

    // Create a new Header from the HeaderView
    let header = bam::Header::from_template(&header_view);

    // Create output writer with the same header and configure threading
    let mut writer = bam::Writer::from_path(output_path, &header, Format::Bam)
        .map_err(PathoscopeError::Htslib)?;

    writer.set_threads(proc).map_err(PathoscopeError::Htslib)?;

    let mut all_subtracted_read_ids = HashSet::new();
    let mut write_buffer: Vec<bam::Record> = Vec::with_capacity(CHUNK_SIZE);

    reader.stream_chunks(|chunk| {
        let mut chunk_records_to_write = Vec::new();
        let mut chunk_subtracted_read_ids = HashSet::new();

        for record in chunk {
            if record.is_unmapped() {
                continue;
            }

            let read_id_str = unsafe { std::str::from_utf8_unchecked(record.qname()) };

            if record.tid() < 0 {
                continue;
            }

            let isolate_score = match extract_alignment_score(record) {
                Some(score) => score as f32,
                None => continue,
            };

            if processor.should_eliminate(read_id_str, isolate_score) {
                chunk_subtracted_read_ids.insert(read_id_str.to_string());
            } else {
                chunk_records_to_write.push(record.clone());
            }
        }

        all_subtracted_read_ids.extend(chunk_subtracted_read_ids);
        write_buffer.extend(chunk_records_to_write);

        if write_buffer.len() >= CHUNK_SIZE {
            for record in &write_buffer {
                writer.write(record).map_err(PathoscopeError::Htslib)?;
            }
            write_buffer.clear();
        }

        Ok(())
    })?;

    for record in &write_buffer {
        writer.write(record).map_err(PathoscopeError::Htslib)?;
    }

    Ok(all_subtracted_read_ids)
}

/// Filter FASTQ file by removing reads whose IDs are in the subtracted set
///
/// # Arguments
/// * `input_fastq_path` - Path to input FASTQ file
/// * `output_fastq_path` - Path to output FASTQ file  
/// * `subtracted_ids` - Set of read IDs to filter out
///
/// # Returns
/// Result indicating success or failure
pub fn filter_fastq_file(
    input_fastq_path: &str,
    output_fastq_path: &str,
    subtracted_ids: &HashSet<String>,
) -> Result<(), PathoscopeError> {
    info!(
        "filtering FASTQ file: {} -> {}",
        input_fastq_path, output_fastq_path
    );

    let input_file = File::open(input_fastq_path).map_err(PathoscopeError::Io)?;

    let output_file = File::create(output_fastq_path).map_err(PathoscopeError::Io)?;

    let mut reader = BufReader::new(input_file);
    let mut writer = BufWriter::new(output_file);

    let mut lines = Vec::with_capacity(4);

    loop {
        lines.clear();

        // Read 4 lines for a FASTQ record
        for _ in 0..4 {
            let mut line = String::default();
            match reader.read_line(&mut line) {
                Ok(0) => break, // EOF
                Ok(_) => lines.push(line),
                Err(e) => return Err(PathoscopeError::Io(e)),
            }
        }

        // Check if we reached EOF
        if lines.is_empty() {
            break;
        }

        // Check if we have a complete 4-line record
        if lines.len() != 4 {
            break;
        }

        // Extract read ID from the first line (header line starting with @)
        let header = &lines[0];
        if !header.starts_with('@') {
            return Err(PathoscopeError::Parse(
                "Invalid FASTQ format: header line should start with '@'".to_string(),
            ));
        }

        // Get read ID (everything after @ until first whitespace or newline)
        let read_id = header[1..]
            .split_whitespace()
            .next()
            .unwrap_or("")
            .trim_end_matches('\n')
            .trim_end_matches('\r');

        // If this read ID is not in the subtracted set, write all 4 lines
        if !subtracted_ids.contains(read_id) {
            for line in &lines {
                writer
                    .write_all(line.as_bytes())
                    .map_err(PathoscopeError::Io)?;
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_subtraction_scores() -> FxHashMap<String, f32> {
        let mut scores = FxHashMap::default();
        scores.insert("read1".to_string(), 250.0);
        scores.insert("read2".to_string(), 300.0);
        scores.insert("read3".to_string(), 150.0);
        scores
    }

    #[test]
    fn test_should_eliminate_higher_subtraction_score() {
        let processor = SubtractionProcessor::new(create_test_subtraction_scores());

        // Isolate score (200) < subtraction score (250) -> eliminate
        assert!(processor.should_eliminate("read1", 200.0));
    }

    #[test]
    fn test_should_eliminate_equal_scores() {
        let processor = SubtractionProcessor::new(create_test_subtraction_scores());

        // Isolate score (250) == subtraction score (250) -> eliminate
        assert!(processor.should_eliminate("read1", 250.0));
    }

    #[test]
    fn test_should_not_eliminate_lower_subtraction_score() {
        let processor = SubtractionProcessor::new(create_test_subtraction_scores());

        // Isolate score (350) > subtraction score (300) -> keep
        assert!(!processor.should_eliminate("read2", 350.0));
    }

    #[test]
    fn test_should_not_eliminate_unknown_read() {
        let processor = SubtractionProcessor::new(create_test_subtraction_scores());

        // Read not in subtraction -> keep
        assert!(!processor.should_eliminate("unknown_read", 100.0));
    }

    #[test]
    fn test_subtraction_processor_empty_scores() {
        let processor = SubtractionProcessor::new(FxHashMap::default());

        // With no subtraction scores, nothing should be eliminated
        assert!(!processor.should_eliminate("any_read", 1000.0));
        assert!(!processor.should_eliminate("any_read", 0.0));
    }

    #[test]
    fn test_parse_subtraction_sam() {
        let result = parse_subtraction_scores_from_bam(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/test_basic.sam"
        ))
        .unwrap();

        // Expected scores based on the SAM file content:
        // read1: AS:i:45 + read_length:50 = 95.0
        // read2: AS:i:25 + read_length:30 = 55.0
        // read3: AS:i:2 + read_length:40 = 42.0

        assert_eq!(result.len(), 3, "Should parse exactly 3 valid alignments");

        assert_eq!(
            result.get("read1"),
            Some(&95.0),
            "First read should have score 95.0"
        );

        assert_eq!(
            result.get("read2"),
            Some(&55.0),
            "Second read should have score 55.0"
        );

        assert_eq!(
            result.get("read3"),
            Some(&42.0),
            "Third read should have score 42.0"
        );
    }
}
