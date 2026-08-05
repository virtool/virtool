use crate::sam::{extract_alignment_score, SamReader};
use crate::{MultiMappingReads, PathoscopeError, UniqueReads};
use log::info;
use rustc_hash::{FxHashMap, FxHashSet};

/// A matrix containing alignment data and metadata.
///
/// This struct encapsulates all the data produced by matrix building,
/// providing a clean interface and methods for processing alignment data.
#[derive(Debug, Clone)]
pub struct PathoscopeMatrix {
    pub unique_reads: UniqueReads,
    pub multi_mapping_reads: MultiMappingReads,
    pub refs: Vec<String>,
    pub reads: Vec<String>,
    pub max_score: f64,
    pub min_score: f64,
}

impl PathoscopeMatrix {
    /// Create empty PathoscopeMatrix for incremental building
    pub fn new() -> Self {
        PathoscopeMatrix {
            unique_reads: FxHashMap::default(),
            multi_mapping_reads: FxHashMap::default(),
            refs: Vec::new(),
            reads: Vec::new(),
            max_score: 0.0,
            min_score: f64::INFINITY,
        }
    }

    /// Rescale alignment scores using the existing rescale_samscore function
    fn rescale_scores(&mut self, u_temp: MultiMappingReads) {
        let (u, nu) = rescale_samscore(
            u_temp,
            &mut self.multi_mapping_reads,
            self.max_score,
            self.min_score,
        );
        self.multi_mapping_reads = nu;

        self.unique_reads = FxHashMap::default();
        for (read_idx, (ref_indices, scores, _, _)) in u {
            if let (Some(first_ref), Some(first_score)) =
                (ref_indices.first(), scores.first())
            {
                self.unique_reads
                    .insert(read_idx, (*first_ref, *first_score));
            }
        }
    }

    /// Normalize multi-mapping read scores so they sum to 1.0
    fn normalize_multi_mapping(&mut self) {
        for k in self
            .multi_mapping_reads
            .keys()
            .cloned()
            .collect::<Vec<i32>>()
        {
            if let Some(nu_entry) = self.multi_mapping_reads.get(&k) {
                let p_score_sum = nu_entry.1.iter().sum::<f64>();
                if let Some(nu_entry_mut) = self.multi_mapping_reads.get_mut(&k) {
                    nu_entry_mut.2 = nu_entry_mut
                        .1
                        .iter()
                        .map(|data| data / p_score_sum)
                        .collect();
                }
            }
        }
    }

    /// Add a single alignment to the matrix during incremental building
    ///
    /// # Arguments
    /// * `read_index` - Index of the read
    /// * `ref_index` - Index of the reference
    /// * `score` - Alignment score
    /// * `read_alignments` - Mutable reference to read alignments map for tracking
    pub fn add_alignment(
        &mut self,
        read_index: i32,
        ref_index: i32,
        score: f64,
        read_alignments: &mut FxHashMap<i32, (FxHashSet<i32>, Vec<(i32, f64)>)>,
    ) {
        self.max_score = self.max_score.max(score);
        self.min_score = self.min_score.min(score);
        let (seen_refs, alignments) = read_alignments.entry(read_index).or_default();
        if seen_refs.insert(ref_index) {
            alignments.push((ref_index, score));
        }
    }

    /// Finalize the matrix after all alignments have been added
    ///
    /// This method processes the read_alignments to classify reads as unique
    /// or multi-mapping, then performs rescaling and normalization.
    ///
    /// # Arguments
    /// * `read_alignments` - Map of read indices to their alignment data
    pub fn finalize(
        &mut self,
        read_alignments: FxHashMap<i32, (FxHashSet<i32>, Vec<(i32, f64)>)>,
    ) {
        let mut u_temp: MultiMappingReads = FxHashMap::default();
        let mut nu: MultiMappingReads = FxHashMap::default();

        for (read_index, (_, read_alignments)) in read_alignments {
            if read_alignments.len() == 1 {
                let (ref_index, score) = read_alignments[0];
                u_temp.insert(
                    read_index,
                    (vec![ref_index], vec![score], vec![score], score),
                );
            } else {
                let ref_indices: Vec<i32> = read_alignments
                    .iter()
                    .map(|(ref_idx, _)| *ref_idx)
                    .collect();
                let scores: Vec<f64> =
                    read_alignments.iter().map(|(_, score)| *score).collect();
                let max_score =
                    scores.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

                nu.insert(read_index, (ref_indices, scores, vec![], max_score));
            }
        }

        self.multi_mapping_reads = nu;

        self.rescale_scores(u_temp);
        self.normalize_multi_mapping();

        let unique_count = self.unique_reads.len();
        let multi_count = self.multi_mapping_reads.len();
        info!(
            "matrix finalized: {} unique reads, {} multi-mapping reads, score range [{:.2}, {:.2}]",
            unique_count, multi_count, self.min_score, self.max_score
        );
    }
}

/// Build the EM matrix.
///
/// # Arguments
/// * `alignment_path` - Path to the SAM/BAM file
/// * `p_score_cutoff` - Optional score cutoff for alignments
pub fn build_matrix(
    alignment_path: &str,
    p_score_cutoff: Option<f64>,
) -> Result<PathoscopeMatrix, PathoscopeError> {
    let p_score_cutoff = p_score_cutoff.unwrap_or(0.01);

    info!(
        "building matrix from '{}' with score cutoff {}",
        alignment_path, p_score_cutoff
    );

    let mut reader = SamReader::new(alignment_path)?;
    let header = reader.header().clone();

    let mut matrix = PathoscopeMatrix::new();
    let mut h_read_id: FxHashMap<String, i32> = FxHashMap::default();
    let mut h_ref_id: FxHashMap<String, i32> = FxHashMap::default();
    let mut ref_count: i32 = 0;
    let mut read_count: i32 = 0;
    let mut read_alignments: FxHashMap<i32, (FxHashSet<i32>, Vec<(i32, f64)>)> =
        FxHashMap::default();

    reader.stream_chunks(|chunk| {
        for record in chunk {
            if record.is_unmapped() {
                continue;
            }
            let read_id = match std::str::from_utf8(record.qname()) {
                Ok(id) => id.to_string(),
                Err(_) => continue,
            };
            let name_bytes = header.tid2name(record.tid() as u32);
            let ref_id = std::str::from_utf8(name_bytes).unwrap_or("*").to_string();
            let total_score = match extract_alignment_score(record) {
                Some(score) => score,
                None => continue,
            };
            if total_score <= p_score_cutoff {
                continue;
            }
            matrix.min_score = total_score.min(matrix.min_score);
            matrix.max_score = total_score.max(matrix.max_score);
            let ref_index = *h_ref_id.entry(ref_id.clone()).or_insert_with(|| {
                let idx = ref_count;
                matrix.refs.push(ref_id);
                ref_count += 1;
                idx
            });
            let read_index = *h_read_id.entry(read_id.clone()).or_insert_with(|| {
                let idx = read_count;
                matrix.reads.push(read_id);
                read_count += 1;
                idx
            });
            matrix.add_alignment(
                read_index,
                ref_index,
                total_score,
                &mut read_alignments,
            );
        }
        Ok(())
    })?;

    matrix.finalize(read_alignments);

    Ok(matrix)
}

/// modifies the scores of u and nu with respect to max_score and min_score
fn rescale_samscore(
    mut u: MultiMappingReads,
    nu: &mut MultiMappingReads,
    max_score: f64,
    min_score: f64,
) -> (MultiMappingReads, MultiMappingReads) {
    let scaling_factor: f64 = if min_score < 0.0 {
        100.0 / (max_score - min_score)
    } else {
        100.0 / max_score
    };

    for k in u.keys().cloned().collect::<Vec<i32>>() {
        if let Some(entry) = u.get_mut(&k) {
            if min_score < 0.0 {
                entry.1[0] -= min_score;
            }
            entry.1[0] = f64::exp(entry.1[0] * scaling_factor);
            entry.3 = entry.1[0];
        }
    }

    for k in nu.keys().cloned().collect::<Vec<i32>>() {
        if let Some(entry) = nu.get_mut(&k) {
            entry.3 = 0.0;

            for i in 0..entry.1.len() {
                if min_score < 0.0 {
                    entry.1[i] -= min_score;
                }

                entry.1[i] = f64::exp(entry.1[i] * scaling_factor);

                if entry.1[i] > entry.3 {
                    entry.3 = entry.1[i];
                }
            }
        }
    }
    (u, std::mem::take(nu))
}

#[cfg(test)]
mod tests {
    use crate::matrix::*;

    #[test]
    fn test_build_matrix() {
        let matrix = build_matrix(
            concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/tests/fixtures/minimal_test.sam"
            ),
            None,
        )
        .unwrap();

        assert_eq!(matrix.refs.len(), 2, "Should have 2 references");
        assert_eq!(matrix.reads.len(), 3, "Should have 3 reads");
        assert_eq!(
            matrix.unique_reads.len(),
            2,
            "Should have 2 unique reads (read1, read2)"
        );
        assert_eq!(
            matrix.multi_mapping_reads.len(),
            1,
            "Should have 1 non-unique read (read3)"
        );

        // Verify reference names
        assert!(matrix.refs.contains(&"ref1".to_string()));
        assert!(matrix.refs.contains(&"ref2".to_string()));

        // Verify read names
        assert!(matrix.reads.contains(&"read1".to_string()));
        assert!(matrix.reads.contains(&"read2".to_string()));
        assert!(matrix.reads.contains(&"read3".to_string()));

        // Verify data structure integrity
        for (_, (ref_idx, score)) in &matrix.unique_reads {
            assert!(
                *ref_idx >= 0 && *ref_idx < matrix.refs.len() as i32,
                "U matrix ref index should be valid"
            );
            assert!(*score > 0.0, "U matrix scores should be positive");
        }

        for (_, (ref_indices, scores, normalized_scores, max_score)) in
            &matrix.multi_mapping_reads
        {
            assert!(
                ref_indices.len() > 1,
                "NU entries should map to multiple references"
            );
            assert_eq!(
                ref_indices.len(),
                scores.len(),
                "NU ref_indices and scores should have same length"
            );
            assert_eq!(
                scores.len(),
                normalized_scores.len(),
                "NU scores and normalized_scores should have same length"
            );

            // Verify normalized scores sum to approximately 1.0
            let sum: f64 = normalized_scores.iter().sum();
            assert!(
                (sum - 1.0).abs() < 0.001,
                "Normalized scores should sum to 1.0"
            );

            assert!(*max_score > 0.0, "Max score should be positive");

            // Verify all ref indices are valid
            for &ref_idx in ref_indices {
                assert!(
                    ref_idx >= 0 && ref_idx < matrix.refs.len() as i32,
                    "NU ref index should be valid"
                );
            }
        }

        // Verify no duplicate references or reads
        let mut unique_refs = matrix.refs.clone();
        unique_refs.sort();
        unique_refs.dedup();
        assert_eq!(
            matrix.refs.len(),
            unique_refs.len(),
            "References should be unique"
        );

        let mut unique_reads = matrix.reads.clone();
        unique_reads.sort();
        unique_reads.dedup();
        assert_eq!(
            matrix.reads.len(),
            unique_reads.len(),
            "Reads should be unique"
        );
    }
}
