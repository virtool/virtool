use crate::PathoscopeError;
use rust_htslib::{bam, bam::HeaderView, bam::Read};
use rustc_hash::FxHasher;
use std::hash::{Hash, Hasher};

/// Simple streaming SAM/BAM reader with chunked processing.
pub struct SamReader {
    reader: bam::Reader,
    header: HeaderView,
}

/// Fixed chunk size for all streaming operations.
pub const CHUNK_SIZE: usize = 10000;

impl SamReader {
    /// Create a new SamReader from a file path
    ///
    /// # Arguments
    /// * `path` - Path to the SAM or BAM file
    ///
    /// # Returns
    /// Result containing SamReader or PathoscopeError
    pub fn new(path: &str) -> Result<Self, PathoscopeError> {
        let reader = bam::Reader::from_path(path)?;

        let header = reader.header().clone();

        Ok(SamReader { reader, header })
    }

    /// Get a reference to the BAM header
    pub fn header(&self) -> &HeaderView {
        &self.header
    }

    /// Stream records in chunks, calling the provided callback for each chunk
    ///
    /// # Arguments
    /// * `callback` - Function called with each chunk of records
    ///
    /// # Returns
    /// Result indicating success or error
    pub fn stream_chunks<F>(&mut self, mut callback: F) -> Result<(), PathoscopeError>
    where
        F: FnMut(&[bam::Record]) -> Result<(), PathoscopeError>,
    {
        loop {
            let mut chunk = Vec::with_capacity(CHUNK_SIZE);

            // Read a chunk of records
            for _ in 0..CHUNK_SIZE {
                let mut record = bam::Record::new();
                match self.reader.read(&mut record) {
                    Some(Ok(_)) => chunk.push(record),
                    Some(Err(e)) => {
                        return Err(PathoscopeError::Parse(format!(
                            "Error reading BAM record: {}",
                            e
                        )))
                    }
                    None => break, // EOF
                }
            }

            if chunk.is_empty() {
                break;
            }

            // Process this chunk
            callback(&chunk)?;
        }

        Ok(())
    }
}

/// Extract alignment score from a BAM record
///
/// This function extracts the AS:i auxiliary field value and calculates the total score
/// by adding it to the read length, following the original PathOScope logic.
///
/// # Arguments
/// * `record` - BAM record to extract score from
///
/// # Returns
/// Some(total_score) if AS field is found and valid, None otherwise
pub fn extract_alignment_score(record: &bam::Record) -> Option<f64> {
    let read_length = record.seq_len() as f64;

    let as_score = match record.aux(b"AS") {
        Ok(aux) => match aux {
            rust_htslib::bam::record::Aux::I32(score) => score as f64,
            rust_htslib::bam::record::Aux::I8(score) => score as f64,
            rust_htslib::bam::record::Aux::I16(score) => score as f64,
            rust_htslib::bam::record::Aux::U8(score) => score as f64,
            rust_htslib::bam::record::Aux::U16(score) => score as f64,
            rust_htslib::bam::record::Aux::U32(score) => score as f64,
            _ => return None, // Skip records with unexpected AS type
        },
        Err(_) => return None, // Skip records without AS field
    };

    Some(as_score + read_length)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sam_reader_basic() {
        let mut reader = SamReader::new(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/test_basic.sam"
        ))
        .unwrap();

        let mut total_records = 0;
        let mut chunk_count = 0;

        reader
            .stream_chunks(|chunk| {
                chunk_count += 1;
                total_records += chunk.len();

                // Verify we can access records
                for record in chunk {
                    if !record.is_unmapped() {
                        let _read_id = std::str::from_utf8(record.qname()).unwrap();
                        let _score = extract_alignment_score(record);
                    }
                }

                Ok(())
            })
            .unwrap();

        assert!(total_records > 0, "Should read some records");
        assert!(chunk_count > 0, "Should process at least one chunk");
    }

    #[test]
    fn test_extract_alignment_score() {
        let mut reader = SamReader::new(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/test_basic.sam"
        ))
        .unwrap();

        let mut found_score = false;

        reader
            .stream_chunks(|chunk| {
                for record in chunk {
                    if !record.is_unmapped() {
                        if let Some(score) = extract_alignment_score(record) {
                            assert!(score > 0.0, "Score should be positive");
                            found_score = true;
                        }
                    }
                }
                Ok(())
            })
            .unwrap();

        assert!(found_score, "Should find at least one valid score");
    }
}
