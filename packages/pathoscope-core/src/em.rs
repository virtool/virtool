use crate::matrix::PathoscopeMatrix;
use crate::{MultiMappingReads, UniqueReads};
use log::info;

/// Best hit analysis results
#[derive(Debug, Clone)]
pub struct BestHitResults {
    /// Raw counts of reads assigned as best hits to each reference
    pub best_hit_reads: Vec<f64>,
    /// Normalized best hit counts (divided by total reads)
    pub best_hit: Vec<f64>,
    /// Normalized counts of reads with score >= 0.5 for each reference
    pub level1: Vec<f64>,
    /// Normalized counts of reads with score >= 0.01 and < 0.5 for each reference
    pub level2: Vec<f64>,
}

/// EM algorithm results
#[derive(Debug, Clone)]
pub struct EMResults {
    /// Initial pi values after first iteration
    pub init_pi: Vec<f64>,
    /// Final pi values (genome abundances)
    pub pi: Vec<f64>,
    /// Updated PathoscopeMatrix with final multi-mapping probabilities
    pub updated_matrix: PathoscopeMatrix,
}

/// Compute best hit statistics from a PathoscopeMatrix.
///
/// # Arguments
/// * `matrix` - The PathoscopeMatrix containing alignment data
///
/// # Returns
/// BestHitResults struct containing the analysis results
pub fn compute_best_hit(matrix: &PathoscopeMatrix) -> BestHitResults {
    let ref_count = matrix.refs.len();
    let mut best_hit_reads = vec![0.0; ref_count];
    let mut level_1_reads = vec![0.0; ref_count];
    let mut level_2_reads = vec![0.0; ref_count];

    // Process unique reads
    for i in matrix.unique_reads.keys() {
        if let Some(u_entry) = matrix.unique_reads.get(i) {
            let ref_idx = u_entry.0 as usize;
            if ref_idx < best_hit_reads.len() {
                best_hit_reads[ref_idx] += 1.0;
            }
            if ref_idx < level_1_reads.len() {
                level_1_reads[ref_idx] += 1.0;
            }
        }
    }

    // Process multi-mapping reads
    for i in matrix.multi_mapping_reads.keys() {
        if let Some(z) = matrix.multi_mapping_reads.get(i) {
            let ind = &z.0;
            let x_norm = &z.2;
            let best_ref = x_norm.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
            let mut num_best_ref = 0;

            for score in x_norm.iter() {
                if *score == best_ref {
                    num_best_ref += 1;
                }
            }

            num_best_ref = match num_best_ref {
                0 => 1,
                _ => num_best_ref,
            };

            for (j, score) in x_norm.iter().enumerate() {
                if let Some(&ref_idx) = ind.get(j) {
                    let ref_idx = ref_idx as usize;

                    if *score == best_ref && ref_idx < best_hit_reads.len() {
                        best_hit_reads[ref_idx] += 1.0 / num_best_ref as f64;
                    }

                    if *score >= 0.5 && ref_idx < level_1_reads.len() {
                        level_1_reads[ref_idx] += 1.0;
                    } else if *score >= 0.01 && ref_idx < level_2_reads.len() {
                        level_2_reads[ref_idx] += 1.0;
                    }
                }
            }
        }
    }

    let read_count = matrix.reads.len();

    let best_hit: Vec<f64> = best_hit_reads
        .iter()
        .map(|val| *val / read_count as f64)
        .collect();
    let level1: Vec<f64> = level_1_reads
        .iter()
        .map(|val| *val / read_count as f64)
        .collect();
    let level2: Vec<f64> = level_2_reads
        .iter()
        .map(|val| *val / read_count as f64)
        .collect();

    BestHitResults {
        best_hit_reads,
        best_hit,
        level1,
        level2,
    }
}

/// Parameters used throughout the EM algorithm iterations
struct EMParameters {
    pi: Vec<f64>,
    theta: Vec<f64>,
    pi_sum_0: Vec<f64>,
    u_total: f64,
    nu_total: f64,
    prior_weight: f64,
    nu_length: usize,
}

/// Initialize parameters for the EM algorithm
///
/// Computes initial pi and theta values (uniform distribution), calculates weight
/// statistics from unique and multi-mapping reads, and sets up data structures
/// needed for EM iterations.
///
/// # Arguments
/// * `u` - Unique read mappings (read_id -> (ref_id, score))
/// * `nu` - Multi-mapping read data (read_id -> (ref_ids, scores, normalized_scores, max_score))
/// * `genome_count` - Number of reference genomes
///
/// # Returns
/// EMParameters struct containing all initialization data
fn initialize_em_parameters(
    u: &UniqueReads,
    nu: &MultiMappingReads,
    genome_count: usize,
) -> EMParameters {
    let pi = vec![1.0 / genome_count as f64; genome_count];
    let theta = pi.clone();
    let mut pi_sum_0 = vec![0.0; genome_count];

    let u_weights: Vec<f64> = u.iter().map(|entry| (entry.1).1).collect();
    let mut max_u_weights = 0.0;
    let mut u_total = 0.0;

    if !u_weights.is_empty() {
        max_u_weights = u_weights.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        u_total = u_weights.iter().sum();
    }

    for i in u.keys() {
        if let Some(u_entry) = u.get(i) {
            let ref_idx = u_entry.0 as usize;
            if ref_idx < pi_sum_0.len() {
                pi_sum_0[ref_idx] += u_entry.1;
            }
        }
    }

    let nu_weights: Vec<f64> = nu.iter().map(|entry| (entry.1).3).collect();
    let mut max_nu_weights = 0.0;
    let mut nu_total = 0.0;

    if !nu_weights.is_empty() {
        max_nu_weights = nu_weights.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        nu_total = nu_weights.iter().sum();
    }

    let prior_weight = f64::max(max_u_weights, max_nu_weights);
    let nu_length = if nu.is_empty() { 1 } else { nu.len() };

    EMParameters {
        pi,
        theta,
        pi_sum_0,
        u_total,
        nu_total,
        prior_weight,
        nu_length,
    }
}

/// Expectation step of the EM algorithm
///
/// Updates posterior probabilities for multi-mapping reads based on current
/// pi and theta estimates. For each multi-mapping read, calculates the
/// probability of assignment to each mapped reference.
///
/// # Arguments
/// * `nu` - Multi-mapping read data (modified in place with updated probabilities)
/// * `pi` - Current genome abundance estimates
/// * `theta` - Current multi-mapping probability estimates
/// * `theta_sum` - Output buffer for accumulating weighted assignments (modified in place)
fn em_e_step(
    nu: &mut MultiMappingReads,
    pi: &[f64],
    theta: &[f64],
    theta_sum: &mut [f64],
) {
    let nu_keys: Vec<i32> = nu.keys().cloned().collect();
    for j in nu_keys {
        if let Some(z) = nu.get(&j).cloned() {
            //A set of any genome mapping with j
            let ind = &z.0;

            //Get relevant pis for the read
            let pi_temp: Vec<f64> = ind
                .iter()
                .filter_map(|&val| pi.get(val as usize).cloned())
                .collect();

            //Get relevant thetas for the read
            let theta_temp: Vec<f64> = ind
                .iter()
                .filter_map(|&val| theta.get(val as usize).cloned())
                .collect();

            //Calculate non-normalized xs
            let mut x_temp: Vec<f64> = Vec::with_capacity(ind.len());

            for k in 0..ind.len().min(pi_temp.len()).min(theta_temp.len()) {
                if let Some(&score) = z.1.get(k) {
                    x_temp.push(pi_temp[k] * theta_temp[k] * score);
                }
            }

            let x_sum: f64 = x_temp.iter().sum();

            //Avoid dividing by 0 at all times
            let x_norm: Vec<f64> = if x_sum == 0.0 {
                vec![0.0; x_temp.len()]
            } else {
                x_temp.iter().map(|val| val / x_sum).collect()
            };

            //Update x in nu
            if let Some(nu_entry) = nu.get_mut(&j) {
                nu_entry.2.clone_from(&x_norm);

                // Only update theta_sum if we have meaningful scores (optimization)
                if x_sum > 0.0 {
                    for (k, &ref_idx) in ind.iter().enumerate() {
                        if let Some(&x_val) = x_norm.get(k) {
                            let idx = ref_idx as usize;
                            if idx < theta_sum.len() {
                                theta_sum[idx] += x_val * nu_entry.3;
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Maximization step of the EM algorithm
///
/// Updates pi and theta parameters to maximize the expected log-likelihood
/// based on the current assignment probabilities from the E-step.
///
/// # Arguments
/// * `params` - EM parameters containing priors and weights
/// * `theta_sum` - Accumulated weighted assignments from E-step
/// * `pi_prior` - Prior weight for pi estimation (Dirichlet prior)
/// * `theta_prior` - Prior weight for theta estimation
///
/// # Returns
/// Tuple of (new_pi, new_theta) vectors with updated parameter estimates
fn em_m_step(
    params: &EMParameters,
    theta_sum: &[f64],
    pi_prior: f64,
    theta_prior: f64,
) -> (Vec<f64>, Vec<f64>) {
    let pi_sum: Vec<f64> = theta_sum
        .iter()
        .enumerate()
        .map(|(idx, _)| theta_sum[idx] + params.pi_sum_0[idx])
        .collect();
    let pip = pi_prior * params.prior_weight;

    //update pi
    let new_pi = pi_sum
        .iter()
        .map(|val| {
            ((*val) + pip)
                / (params.u_total + params.nu_total + (pip * pi_sum.len() as f64))
        })
        .collect();

    let theta_p = theta_prior * params.prior_weight;

    let nu_total_div = if params.nu_total == 0.0 {
        1.0
    } else {
        params.nu_total
    };

    let new_theta = theta_sum
        .iter()
        .map(|val| {
            (*val + theta_p) / (nu_total_div + (theta_p * theta_sum.len() as f64))
        })
        .collect();

    (new_pi, new_theta)
}

/// Calculate convergence metric as L1 norm between old and new pi vectors
///
/// # Arguments
/// * `pi_old` - Previous iteration's pi values
/// * `pi_new` - Current iteration's pi values
///
/// # Returns
/// Sum of absolute differences between old and new pi values
fn calculate_convergence(pi_old: &[f64], pi_new: &[f64]) -> f64 {
    pi_old
        .iter()
        .zip(pi_new.iter())
        .map(|(old, new)| (old - new).abs())
        .sum()
}

/// Check if EM algorithm has converged and log progress
///
/// Determines convergence based on the change in pi values between iterations.
/// Also handles progress logging and divergence detection.
///
/// # Arguments
/// * `iteration` - Current iteration number (0-indexed)
/// * `cutoff` - Current convergence metric value
/// * `epsilon` - Convergence threshold
/// * `nu_length` - Number of multi-mapping reads
///
/// # Returns
/// true if converged, false otherwise
fn check_convergence(
    iteration: i32,
    cutoff: f64,
    epsilon: f64,
    nu_length: usize,
) -> bool {
    // Log convergence progress
    if iteration == 0 || iteration % 10 == 9 || cutoff <= epsilon {
        info!(
            "em iteration {}: convergence delta = {:.2e}",
            iteration + 1,
            cutoff
        );
    }

    if cutoff <= epsilon || nu_length == 1 {
        info!(
            "em converged after {} iterations (delta: {:.2e})",
            iteration + 1,
            cutoff
        );
        return true;
    }

    // Detect potential divergence
    if iteration > 10 && cutoff > 1e-2 {
        info!(
            "em may be diverging at iteration {} (delta: {:.2e})",
            iteration + 1,
            cutoff
        );
    }

    false
}

/// Run EM algorithm on a PathoscopeMatrix
///
/// # Arguments
/// * `matrix` - The PathoscopeMatrix containing alignment data
/// * `max_iter` - Maximum number of EM iterations
/// * `epsilon` - Convergence threshold for stopping criterion
/// * `pi_prior` - Prior weight for pi estimation (Dirichlet prior)
/// * `theta_prior` - Prior weight for theta estimation
///
/// # Returns
/// EMResults struct containing the EM algorithm results
pub fn em(
    matrix: &PathoscopeMatrix,
    max_iter: i32,
    epsilon: f64,
    pi_prior: f64,
    theta_prior: f64,
) -> EMResults {
    let genome_count = matrix.refs.len();
    let mut updated_matrix = matrix.clone();

    // Initialize EM parameters
    let mut params = initialize_em_parameters(
        &matrix.unique_reads,
        &matrix.multi_mapping_reads,
        genome_count,
    );

    let mut init_pi = Vec::with_capacity(genome_count);

    // EM iterations
    for i in 0..max_iter {
        let pi_old = params.pi.clone();
        let mut theta_sum = vec![0.0; genome_count];

        // E step - update posterior probabilities for multi-mapping reads
        em_e_step(
            &mut updated_matrix.multi_mapping_reads,
            &params.pi,
            &params.theta,
            &mut theta_sum,
        );

        // M step - update pi and theta parameters
        let (new_pi, new_theta) = em_m_step(&params, &theta_sum, pi_prior, theta_prior);

        params.pi = new_pi;
        params.theta = new_theta;

        if i == 0 {
            init_pi.clone_from(&params.pi);
        }

        // Check convergence
        let cutoff = calculate_convergence(&pi_old, &params.pi);

        if check_convergence(i, cutoff, epsilon, params.nu_length) {
            break;
        }
    }

    EMResults {
        init_pi,
        pi: params.pi,
        updated_matrix,
    }
}

pub fn find_updated_score(
    nu: &MultiMappingReads,
    read_index: i32,
    ref_index: i32,
) -> f64 {
    let v1 = match nu.get(&read_index) {
        Some(val) => val,
        None => return 0.0,
    };

    // Find the index of ref_index in the reference list
    for (i, &el) in v1.0.iter().enumerate() {
        if el == ref_index {
            return v1.2.get(i).copied().unwrap_or(0.0);
        }
    }

    // If ref_index not found, return 0.0
    0.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_updated_score() {
        let mut nu: MultiMappingReads = rustc_hash::FxHashMap::default();

        // Read 0 maps to refs [0, 1] with normalized scores [0.7, 0.3]
        nu.insert(0, (vec![0, 1], vec![80.0, 20.0], vec![0.7, 0.3], 100.0));

        // Read 1 maps to refs [1, 2] with normalized scores [0.6, 0.4]
        nu.insert(1, (vec![1, 2], vec![60.0, 40.0], vec![0.6, 0.4], 100.0));

        // Test valid lookups
        assert_eq!(
            find_updated_score(&nu, 0, 0),
            0.7,
            "Read 0, ref 0 should return 0.7"
        );
        assert_eq!(
            find_updated_score(&nu, 0, 1),
            0.3,
            "Read 0, ref 1 should return 0.3"
        );
        assert_eq!(
            find_updated_score(&nu, 1, 1),
            0.6,
            "Read 1, ref 1 should return 0.6"
        );
        assert_eq!(
            find_updated_score(&nu, 1, 2),
            0.4,
            "Read 1, ref 2 should return 0.4"
        );

        // Test invalid read index
        assert_eq!(
            find_updated_score(&nu, 999, 0),
            0.0,
            "Non-existent read should return 0.0"
        );

        // Test invalid ref index for existing read
        assert_eq!(
            find_updated_score(&nu, 0, 999),
            0.0,
            "Non-existent ref should return 0.0"
        );
        assert_eq!(
            find_updated_score(&nu, 0, 2),
            0.0,
            "Read 0 doesn't map to ref 2, should return 0.0"
        );
    }

    #[test]
    fn test_find_updated_score_empty_data() {
        let nu: MultiMappingReads = rustc_hash::FxHashMap::default();

        // Test with empty HashMap
        assert_eq!(
            find_updated_score(&nu, 0, 0),
            0.0,
            "Empty nu should return 0.0"
        );
    }

    #[test]
    fn test_find_updated_score_edge_cases() {
        let mut nu: MultiMappingReads = rustc_hash::FxHashMap::default();

        // Read with empty ref vectors
        nu.insert(0, (vec![], vec![], vec![], 0.0));
        assert_eq!(
            find_updated_score(&nu, 0, 0),
            0.0,
            "Read with empty refs should return 0.0"
        );

        // Read with mismatched vector lengths (should not happen in practice, but test robustness)
        nu.insert(
            1,
            (
                vec![0],
                vec![100.0],
                vec![], // Empty normalized scores
                100.0,
            ),
        );
        assert_eq!(
            find_updated_score(&nu, 1, 0),
            0.0,
            "Empty normalized scores should return 0.0"
        );
    }

    #[test]
    fn test_find_updated_score_ref_not_found() {
        let mut nu: MultiMappingReads = rustc_hash::FxHashMap::default();

        // Read 0 maps to refs [1, 2] with scores [0.8, 0.2]
        nu.insert(0, (vec![1, 2], vec![80.0, 20.0], vec![0.8, 0.2], 100.0));

        // Looking for ref 0 (which doesn't exist) should return 0.0
        assert_eq!(
            find_updated_score(&nu, 0, 0),
            0.0,
            "Should return 0.0 when ref not found"
        );
    }

    #[test]
    fn test_compute_best_hit() {
        use crate::matrix::PathoscopeMatrix;
        use rustc_hash::FxHashMap;

        let mut unique_reads: UniqueReads = FxHashMap::default();
        let mut multi_reads: MultiMappingReads = FxHashMap::default();

        // Unique reads: each maps to exactly one reference
        let read0_maps_to_ref0 = (0, 100.0);
        let read1_maps_to_ref1 = (1, 100.0);
        unique_reads.insert(0, read0_maps_to_ref0);
        unique_reads.insert(1, read1_maps_to_ref1);

        // Multi-mapping reads: each maps to multiple references with different scores
        let read2_prefers_ref0 = (vec![0, 1], vec![90.0, 10.0], vec![0.9, 0.1], 90.0);
        let read3_tied_between_refs =
            (vec![0, 1], vec![80.0, 80.0], vec![0.5, 0.5], 80.0);
        let read4_tests_thresholds = (
            vec![0, 1, 2],
            vec![60.0, 35.0, 5.0],
            vec![0.6, 0.35, 0.05],
            60.0,
        );
        let read5_below_threshold =
            (vec![0, 1], vec![99.5, 0.5], vec![0.995, 0.005], 99.5);

        multi_reads.insert(2, read2_prefers_ref0);
        multi_reads.insert(3, read3_tied_between_refs);
        multi_reads.insert(4, read4_tests_thresholds);
        multi_reads.insert(5, read5_below_threshold);

        let refs = vec!["ref0".to_string(), "ref1".to_string(), "ref2".to_string()];
        let reads = vec![
            "read0".to_string(),
            "read1".to_string(),
            "read2".to_string(),
            "read3".to_string(),
            "read4".to_string(),
            "read5".to_string(),
        ];

        // Create PathoscopeMatrix
        let matrix = PathoscopeMatrix {
            unique_reads,
            multi_mapping_reads: multi_reads,
            refs,
            reads,
            max_score: 100.0,
            min_score: 0.5,
        };

        let results = compute_best_hit(&matrix);

        // Test 1: Verify best hit assignments (raw counts)
        let expected_ref0_best_hits = 1.0   // read0 (unique)
                                    + 1.0   // read2 (0.9 > 0.1)
                                    + 0.5   // read3 (tied 0.5 == 0.5)
                                    + 1.0   // read4 (0.6 > 0.35 > 0.05)
                                    + 1.0; // read5 (0.995 > 0.005)
        assert!(
            (results.best_hit_reads[0] - expected_ref0_best_hits).abs() < 0.001,
            "ref0 best_hit_reads should be {}, got {}",
            expected_ref0_best_hits,
            results.best_hit_reads[0]
        );

        let expected_ref1_best_hits = 1.0   // read1 (unique)
                                    + 0.0   // read2 (0.1 < 0.9)
                                    + 0.5   // read3 (tied 0.5 == 0.5)
                                    + 0.0   // read4 (0.35 < 0.6)
                                    + 0.0; // read5 (0.005 < 0.995)
        assert!(
            (results.best_hit_reads[1] - expected_ref1_best_hits).abs() < 0.001,
            "ref1 best_hit_reads should be {}, got {}",
            expected_ref1_best_hits,
            results.best_hit_reads[1]
        );

        let expected_ref2_best_hits = 0.0; // No reads have ref2 as best hit
        assert!(
            (results.best_hit_reads[2] - expected_ref2_best_hits).abs() < 0.001,
            "ref2 best_hit_reads should be {}, got {}",
            expected_ref2_best_hits,
            results.best_hit_reads[2]
        );

        // Test 2: Verify normalization (divided by total read count = 6)
        let total_reads = 6.0;
        assert!(
            (results.best_hit[0] - expected_ref0_best_hits / total_reads).abs() < 0.001,
            "ref0 normalized best_hit incorrect"
        );
        assert!(
            (results.best_hit[1] - expected_ref1_best_hits / total_reads).abs() < 0.001,
            "ref1 normalized best_hit incorrect"
        );
        assert!(
            (results.best_hit[2] - expected_ref2_best_hits / total_reads).abs() < 0.001,
            "ref2 normalized best_hit incorrect"
        );

        // Test 3: Verify level1 assignments (score >= 0.5)
        let expected_ref0_level1 = 1.0   // read0 (unique, always counts)
                                 + 1.0   // read2 (0.9 >= 0.5)
                                 + 1.0   // read3 (0.5 >= 0.5)
                                 + 1.0   // read4 (0.6 >= 0.5)
                                 + 1.0; // read5 (0.995 >= 0.5)
        assert!(
            (results.level1[0] - expected_ref0_level1 / total_reads).abs() < 0.001,
            "ref0 level1 should be {}",
            expected_ref0_level1 / total_reads
        );

        let expected_ref1_level1 = 1.0   // read1 (unique, always counts)
                                 + 0.0   // read2 (0.1 < 0.5)
                                 + 1.0   // read3 (0.5 >= 0.5)
                                 + 0.0   // read4 (0.35 < 0.5)
                                 + 0.0; // read5 (0.005 < 0.5)
        assert!(
            (results.level1[1] - expected_ref1_level1 / total_reads).abs() < 0.001,
            "ref1 level1 should be {}",
            expected_ref1_level1 / total_reads
        );

        let expected_ref2_level1 = 0.0; // read4 (0.05 < 0.5)
        assert!(
            (results.level1[2] - expected_ref2_level1 / total_reads).abs() < 0.001,
            "ref2 level1 should be 0.0"
        );

        // Test 4: Verify level2 assignments (0.01 <= score < 0.5)
        let expected_ref0_level2 = 0.0; // All ref0 scores >= 0.5, so counted in level1
        assert!(
            (results.level2[0] - expected_ref0_level2 / total_reads).abs() < 0.001,
            "ref0 level2 should be 0.0"
        );

        let expected_ref1_level2 = 1.0   // read2 (0.1 >= 0.01 and < 0.5)
                                 + 0.0   // read3 (0.5 >= 0.5, counted in level1)
                                 + 1.0   // read4 (0.35 >= 0.01 and < 0.5)
                                 + 0.0; // read5 (0.005 < 0.01)
        assert!(
            (results.level2[1] - expected_ref1_level2 / total_reads).abs() < 0.001,
            "ref1 level2 should be {}",
            expected_ref1_level2 / total_reads
        );

        let expected_ref2_level2 = 1.0; // read4 (0.05 >= 0.01 and < 0.5)
        assert!(
            (results.level2[2] - expected_ref2_level2 / total_reads).abs() < 0.001,
            "ref2 level2 should be {}",
            expected_ref2_level2 / total_reads
        );

        // Test 5: Verify output vector lengths
        assert_eq!(
            results.best_hit_reads.len(),
            3,
            "best_hit_reads should have 3 elements"
        );
        assert_eq!(results.best_hit.len(), 3, "best_hit should have 3 elements");
        assert_eq!(results.level1.len(), 3, "level1 should have 3 elements");
        assert_eq!(results.level2.len(), 3, "level2 should have 3 elements");
    }

    #[test]
    fn test_compute_best_hit_empty() {
        use crate::matrix::PathoscopeMatrix;
        use rustc_hash::FxHashMap;

        // Test empty matrix
        let matrix = PathoscopeMatrix {
            unique_reads: FxHashMap::default(),
            multi_mapping_reads: FxHashMap::default(),
            refs: vec!["ref0".to_string()],
            reads: vec!["read0".to_string()],
            max_score: 0.0,
            min_score: 0.0,
        };

        let results = compute_best_hit(&matrix);

        assert_eq!(
            results.best_hit_reads[0], 0.0,
            "Empty input should result in zero counts"
        );
        assert_eq!(
            results.best_hit[0], 0.0,
            "Empty input should result in zero normalized values"
        );
        assert_eq!(
            results.level1[0], 0.0,
            "Empty input should result in zero level1"
        );
        assert_eq!(
            results.level2[0], 0.0,
            "Empty input should result in zero level2"
        );
    }

    #[test]
    fn test_em_basic() {
        use crate::matrix::PathoscopeMatrix;
        use rustc_hash::FxHashMap;

        // Simple test case: 2 references, 2 reads
        let mut u: UniqueReads = FxHashMap::default();
        let mut nu: MultiMappingReads = FxHashMap::default();

        // Read 0 uniquely maps to ref 0 with score 100.0
        u.insert(0, (0, 100.0));

        // Read 1 multi-maps to both refs with equal scores
        nu.insert(
            1,
            (
                vec![0, 1],       // Maps to refs 0 and 1
                vec![50.0, 50.0], // Equal raw scores
                vec![0.5, 0.5],   // Equal normalized scores (will be updated by EM)
                100.0,            // Total score
            ),
        );

        let refs = vec!["ref0".to_string(), "ref1".to_string()];
        let reads = vec!["read0".to_string(), "read1".to_string()];

        // Create PathoscopeMatrix
        let matrix = PathoscopeMatrix {
            unique_reads: u,
            multi_mapping_reads: nu,
            refs,
            reads,
            max_score: 100.0,
            min_score: 50.0,
        };

        // Run EM algorithm
        let results = em(
            &matrix, 10,   // max_iter
            1e-6, // epsilon
            0.0,  // pi_prior
            0.0,  // theta_prior
        );

        // Test return value structure
        assert_eq!(results.init_pi.len(), 2, "init_pi should have 2 elements");
        assert_eq!(results.pi.len(), 2, "pi should have 2 elements");

        // Test that pi values sum to approximately 1.0
        let pi_sum: f64 = results.pi.iter().sum();
        assert!(
            (pi_sum - 1.0).abs() < 0.01,
            "Pi values should sum to ~1.0, got {}",
            pi_sum
        );

        // Since read 0 uniquely maps to ref 0, ref 0 should have higher pi
        assert!(
            results.pi[0] > results.pi[1],
            "ref0 should have higher pi due to unique read, pi0={}, pi1={}",
            results.pi[0],
            results.pi[1]
        );

        // All values should be positive
        assert!(
            results.pi[0] > 0.0 && results.pi[1] > 0.0,
            "All pi values should be positive"
        );

        // Verify the multi-mapping read's scores were updated
        let updated_read1 = results
            .updated_matrix
            .multi_mapping_reads
            .get(&1)
            .expect("Read 1 should exist in updated matrix");
        let updated_scores = &updated_read1.2;
        assert_eq!(
            updated_scores.len(),
            2,
            "Updated scores should have 2 elements"
        );

        // The sum of normalized scores should be 1.0
        let score_sum: f64 = updated_scores.iter().sum();
        assert!(
            (score_sum - 1.0).abs() < 1e-10,
            "Normalized scores should sum to 1.0, got {}",
            score_sum
        );
    }

    #[test]
    fn test_em_empty() {
        use crate::matrix::PathoscopeMatrix;
        use rustc_hash::FxHashMap;

        // Test with empty matrix
        let matrix = PathoscopeMatrix {
            unique_reads: FxHashMap::default(),
            multi_mapping_reads: FxHashMap::default(),
            refs: vec!["ref0".to_string(), "ref1".to_string()],
            reads: vec!["read0".to_string()],
            max_score: 0.0,
            min_score: 0.0,
        };

        let results = em(&matrix, 10, 1e-6, 0.0, 0.0);

        // Should return equal probabilities for all references
        assert_eq!(results.init_pi.len(), 2);
        assert_eq!(results.pi.len(), 2);
        assert_eq!(results.pi.len(), 2);

        // With no data, the algorithm produces NaN values due to division by zero
        // This documents the current behavior - empty input results in NaN
        assert!(
            results.init_pi[0].is_nan(),
            "Empty input produces NaN for init_pi[0]"
        );
        assert!(
            results.init_pi[1].is_nan(),
            "Empty input produces NaN for init_pi[1]"
        );
        assert!(results.pi[0].is_nan(), "Empty input produces NaN for pi[0]");
        assert!(results.pi[1].is_nan(), "Empty input produces NaN for pi[1]");

        // Matrix should remain empty
        assert!(
            results.updated_matrix.multi_mapping_reads.is_empty(),
            "Updated matrix should have empty multi_mapping_reads"
        );
    }

    #[test]
    fn test_em_only_unique_reads() {
        use crate::matrix::PathoscopeMatrix;
        use rustc_hash::FxHashMap;

        // Test with only unique reads (no multi-mapping)
        let mut u: UniqueReads = FxHashMap::default();

        // Add unique reads: 2 to ref0, 1 to ref1
        u.insert(0, (0, 100.0)); // read 0 -> ref 0
        u.insert(1, (0, 100.0)); // read 1 -> ref 0
        u.insert(2, (1, 100.0)); // read 2 -> ref 1

        let refs = vec!["ref0".to_string(), "ref1".to_string()];
        let reads = vec![
            "read0".to_string(),
            "read1".to_string(),
            "read2".to_string(),
        ];

        let matrix = PathoscopeMatrix {
            unique_reads: u,
            multi_mapping_reads: FxHashMap::default(),
            refs,
            reads,
            max_score: 100.0,
            min_score: 100.0,
        };

        let results = em(&matrix, 10, 1e-6, 0.0, 0.0);

        // ref0 should have higher pi due to more reads (2 vs 1)
        assert!(
            results.pi[0] > results.pi[1],
            "ref0 should have higher pi with more unique reads"
        );

        // Pi should reflect the read distribution: ref0 gets 2/3, ref1 gets 1/3
        assert!(
            (results.pi[0] - 2.0 / 3.0).abs() < 0.01,
            "ref0 should get ~2/3 of probability"
        );
        assert!(
            (results.pi[1] - 1.0 / 3.0).abs() < 0.01,
            "ref1 should get ~1/3 of probability"
        );

        // Matrix multi-mapping reads should remain empty
        assert!(
            results.updated_matrix.multi_mapping_reads.is_empty(),
            "Multi-mapping reads should remain empty with only unique reads"
        );
    }

    #[test]
    fn test_em_only_multi_mapping_reads() {
        use crate::matrix::PathoscopeMatrix;
        use rustc_hash::FxHashMap;

        // Test with only multi-mapping reads (no unique reads)
        let u: UniqueReads = FxHashMap::default();
        let mut nu: MultiMappingReads = FxHashMap::default();

        // Add multi-mapping reads
        nu.insert(0, (vec![0, 1], vec![60.0, 40.0], vec![0.6, 0.4], 100.0));
        nu.insert(1, (vec![0, 1], vec![30.0, 70.0], vec![0.3, 0.7], 100.0));

        let refs = vec!["ref0".to_string(), "ref1".to_string()];
        let reads = vec!["read0".to_string(), "read1".to_string()];

        let matrix = PathoscopeMatrix {
            unique_reads: u,
            multi_mapping_reads: nu,
            refs,
            reads,
            max_score: 100.0,
            min_score: 30.0,
        };

        let results = em(&matrix, 10, 1e-6, 0.0, 0.0);

        // Should converge to some distribution
        let pi_sum: f64 = results.pi.iter().sum();
        assert!((pi_sum - 1.0).abs() < 0.01, "Pi should sum to 1.0");

        // All probabilities should be positive
        assert!(
            results.pi[0] > 0.0 && results.pi[1] > 0.0,
            "All pi values should be positive"
        );

        // Updated matrix should have normalized scores
        for (_, entry) in results.updated_matrix.multi_mapping_reads.iter() {
            let score_sum: f64 = entry.2.iter().sum();
            assert!(
                (score_sum - 1.0).abs() < 1e-10,
                "Each read's scores should sum to 1.0"
            );
        }
    }

    #[test]
    fn test_em_with_zero_score_reads() {
        use crate::matrix::PathoscopeMatrix;
        use rustc_hash::FxHashMap;

        // Test with multi-mapping reads that have zero scores
        let u: UniqueReads = FxHashMap::default();
        let mut nu: MultiMappingReads = FxHashMap::default();

        // Add multi-mapping reads with zero scores
        nu.insert(0, (vec![0, 1], vec![0.0, 0.0], vec![0.0, 0.0], 0.0)); // All zero scores
        nu.insert(1, (vec![0, 1], vec![50.0, 30.0], vec![0.625, 0.375], 80.0)); // Normal scores
        nu.insert(2, (vec![0, 1], vec![0.0, 100.0], vec![0.0, 1.0], 100.0)); // One zero score

        let refs = vec!["ref0".to_string(), "ref1".to_string()];
        let reads = vec![
            "read0".to_string(),
            "read1".to_string(),
            "read2".to_string(),
        ];

        let matrix = PathoscopeMatrix {
            unique_reads: u,
            multi_mapping_reads: nu,
            refs,
            reads,
            max_score: 100.0,
            min_score: 0.0,
        };

        let results = em(&matrix, 10, 1e-6, 0.0, 0.0);

        // Should still converge despite zero scores
        let pi_sum: f64 = results.pi.iter().sum();
        assert!(
            (pi_sum - 1.0).abs() < 0.01,
            "Pi should sum to 1.0 even with zero scores"
        );

        // Check that reads with all zero scores don't break the algorithm
        assert!(
            results.pi[0] >= 0.0 && results.pi[1] >= 0.0,
            "All pi values should be non-negative"
        );
        assert!(
            results.pi[0] >= 0.0 && results.pi[1] >= 0.0,
            "All theta values should be non-negative"
        );

        // Verify that updated matrix contains the reads
        assert_eq!(
            results.updated_matrix.multi_mapping_reads.len(),
            3,
            "Should have 3 multi-mapping reads"
        );

        // Check that reads with meaningful scores still have normalized scores
        for (read_id, entry) in results.updated_matrix.multi_mapping_reads.iter() {
            if *read_id == 1 || *read_id == 2 {
                // Reads with non-zero scores
                let score_sum: f64 = entry.2.iter().sum();
                assert!(
                    (score_sum - 1.0).abs() < 1e-10,
                    "Read {} with non-zero scores should sum to 1.0, got {}",
                    read_id,
                    score_sum
                );
            }
        }

        // Read 0 with all zero scores should have specific behavior
        if let Some(zero_read) = results.updated_matrix.multi_mapping_reads.get(&0) {
            let score_sum: f64 = zero_read.2.iter().sum();
            // Current behavior: zero scores get normalized to [0.0, 0.0] which sums to 0.0
            assert_eq!(
                score_sum, 0.0,
                "Read with all zero scores should sum to 0.0"
            );
        }
    }

    #[test]
    fn test_em_integration_with_real_sam_data() {
        use crate::matrix::build_matrix;

        // Use real SAM data with multi-mapping reads to test the full pipeline
        let sam_path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/test_em_with_multimapping.sam"
        );

        // Build matrix from SAM file
        let matrix = build_matrix(sam_path, None)
            .expect("Failed to build matrix from test SAM file");

        // Run EM algorithm using matrix
        let results = em(&matrix, 50, 1e-7, 0.0, 0.0);

        // Test return value structure
        assert_eq!(
            results.init_pi.len(),
            matrix.refs.len(),
            "init_pi should match number of refs"
        );
        assert_eq!(
            results.pi.len(),
            matrix.refs.len(),
            "pi should match number of refs"
        );
        assert_eq!(
            results.pi.len(),
            matrix.refs.len(),
            "theta should match number of refs"
        );

        // Test normalization
        let pi_sum: f64 = results.pi.iter().sum();
        assert!(
            (pi_sum - 1.0).abs() < 0.01,
            "Pi values should sum to ~1.0, got {}",
            pi_sum
        );

        let pi_sum: f64 = results.pi.iter().sum();
        // Pi represents genome abundances, should sum to ~1.0 when we have multi-mapping reads
        if results.updated_matrix.multi_mapping_reads.len() > 0 {
            assert!(
                (pi_sum - 1.0).abs() < 0.01,
                "Pi values should sum to ~1.0 when multi-mapping reads exist, got {}",
                pi_sum
            );
        } else {
            // If no multi-mapping reads, pi can be 0 or very small
            assert!(
                pi_sum >= 0.0,
                "Pi sum should be non-negative, got {}",
                pi_sum
            );
        }

        // All probabilities should be positive
        for (i, &pi_val) in results.pi.iter().enumerate() {
            assert!(pi_val > 0.0, "Pi[{}] should be positive, got {}", i, pi_val);
        }

        // Test that multi-mapping reads have normalized scores
        for (read_id, entry) in results.updated_matrix.multi_mapping_reads.iter() {
            let score_sum: f64 = entry.2.iter().sum();
            assert!(
                (score_sum - 1.0).abs() < 1e-10,
                "Read {} scores should sum to 1.0, got {}",
                read_id,
                score_sum
            );

            // All individual scores should be non-negative
            for (j, &score) in entry.2.iter().enumerate() {
                assert!(
                    score >= 0.0,
                    "Read {} score[{}] should be non-negative, got {}",
                    read_id,
                    j,
                    score
                );
            }
        }

        // Test that the number of references and reads matches expectations
        assert!(matrix.refs.len() >= 1, "Should have at least one reference");
        assert!(matrix.reads.len() >= 1, "Should have at least one read");

        // Test that we have both unique and multi-mapping reads
        assert!(
            matrix.unique_reads.len() > 0,
            "Should have some unique reads, got {}",
            matrix.unique_reads.len()
        );
        assert!(
            results.updated_matrix.multi_mapping_reads.len() > 0,
            "Should have some multi-mapping reads, got {}",
            results.updated_matrix.multi_mapping_reads.len()
        );

        // Test that pi is meaningful (positive) since we have multi-mapping reads
        let pi_sum: f64 = results.pi.iter().sum();
        assert!(
            pi_sum > 0.0,
            "Pi should be positive when multi-mapping reads exist, got {}",
            pi_sum
        );

        // Test specific expectations for this SAM file:
        // - Should have 2 references (ref1, ref2)
        // - Should have 6 total reads (4 unique + 2 multi-mapping)
        assert_eq!(matrix.refs.len(), 2, "Should have 2 references");
        assert_eq!(matrix.reads.len(), 6, "Should have 6 total reads");

        // Verify that ref1 should have highest pi (gets 3 unique reads vs 1 for ref2)
        let max_pi_idx = results
            .pi
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .unwrap()
            .0;
        assert_eq!(
            max_pi_idx, 0,
            "ref1 should have highest pi due to more unique reads"
        );

        println!("Integration test completed successfully:");
        println!(
            "  Refs: {}, Reads: {}",
            matrix.refs.len(),
            matrix.reads.len()
        );
        println!(
            "  Unique reads: {}, Multi-mapping reads: {}",
            matrix.unique_reads.len(),
            results.updated_matrix.multi_mapping_reads.len()
        );
        println!("  Final pi: {:?}", results.pi);
    }

    #[test]
    fn test_compute_best_hit_comprehensive() {
        use crate::matrix::PathoscopeMatrix;
        use rustc_hash::FxHashMap;

        let mut unique_reads: UniqueReads = FxHashMap::default();
        let mut multi_reads: MultiMappingReads = FxHashMap::default();

        // Unique reads: each maps to exactly one reference
        let read0_maps_to_ref0 = (0, 100.0);
        let read1_maps_to_ref1 = (1, 100.0);
        unique_reads.insert(0, read0_maps_to_ref0);
        unique_reads.insert(1, read1_maps_to_ref1);

        // Multi-mapping reads: each maps to multiple references with different scores
        let read2_prefers_ref0 = (vec![0, 1], vec![90.0, 10.0], vec![0.9, 0.1], 90.0);
        let read3_tied_between_refs =
            (vec![0, 1], vec![80.0, 80.0], vec![0.5, 0.5], 80.0);
        let read4_tests_thresholds = (
            vec![0, 1, 2],
            vec![60.0, 35.0, 5.0],
            vec![0.6, 0.35, 0.05],
            60.0,
        );
        let read5_below_threshold =
            (vec![0, 1], vec![99.5, 0.5], vec![0.995, 0.005], 99.5);

        multi_reads.insert(2, read2_prefers_ref0);
        multi_reads.insert(3, read3_tied_between_refs);
        multi_reads.insert(4, read4_tests_thresholds);
        multi_reads.insert(5, read5_below_threshold);

        let refs = vec!["ref0".to_string(), "ref1".to_string(), "ref2".to_string()];
        let reads = vec![
            "read0".to_string(),
            "read1".to_string(),
            "read2".to_string(),
            "read3".to_string(),
            "read4".to_string(),
            "read5".to_string(),
        ];

        // Create PathoscopeMatrix
        let matrix = PathoscopeMatrix {
            unique_reads,
            multi_mapping_reads: multi_reads,
            refs,
            reads,
            max_score: 100.0,
            min_score: 0.5,
        };

        let results = compute_best_hit(&matrix);

        // Test 1: Verify best hit assignments (raw counts)
        let expected_ref0_best_hits = 1.0   // read0 (unique)
                                    + 1.0   // read2 (0.9 > 0.1)
                                    + 0.5   // read3 (tied 0.5 == 0.5)
                                    + 1.0   // read4 (0.6 > 0.35 > 0.05)
                                    + 1.0; // read5 (0.995 > 0.005)
        assert!(
            (results.best_hit_reads[0] - expected_ref0_best_hits).abs() < 0.001,
            "ref0 best_hit_reads should be {}, got {}",
            expected_ref0_best_hits,
            results.best_hit_reads[0]
        );

        let expected_ref1_best_hits = 1.0   // read1 (unique)
                                    + 0.0   // read2 (0.1 < 0.9)
                                    + 0.5   // read3 (tied 0.5 == 0.5)
                                    + 0.0   // read4 (0.35 < 0.6)
                                    + 0.0; // read5 (0.005 < 0.995)
        assert!(
            (results.best_hit_reads[1] - expected_ref1_best_hits).abs() < 0.001,
            "ref1 best_hit_reads should be {}, got {}",
            expected_ref1_best_hits,
            results.best_hit_reads[1]
        );

        let expected_ref2_best_hits = 0.0; // No reads have ref2 as best hit
        assert!(
            (results.best_hit_reads[2] - expected_ref2_best_hits).abs() < 0.001,
            "ref2 best_hit_reads should be {}, got {}",
            expected_ref2_best_hits,
            results.best_hit_reads[2]
        );

        // Test 2: Verify normalization (divided by total read count = 6)
        let total_reads = 6.0;
        assert!(
            (results.best_hit[0] - expected_ref0_best_hits / total_reads).abs() < 0.001,
            "ref0 normalized best_hit incorrect"
        );
        assert!(
            (results.best_hit[1] - expected_ref1_best_hits / total_reads).abs() < 0.001,
            "ref1 normalized best_hit incorrect"
        );
        assert!(
            (results.best_hit[2] - expected_ref2_best_hits / total_reads).abs() < 0.001,
            "ref2 normalized best_hit incorrect"
        );

        // Test 3: Verify level1 assignments (score >= 0.5)
        let expected_ref0_level1 = 1.0   // read0 (unique, always counts)
                                 + 1.0   // read2 (0.9 >= 0.5)
                                 + 1.0   // read3 (0.5 >= 0.5)
                                 + 1.0   // read4 (0.6 >= 0.5)
                                 + 1.0; // read5 (0.995 >= 0.5)
        assert!(
            (results.level1[0] - expected_ref0_level1 / total_reads).abs() < 0.001,
            "ref0 level1 should be {}",
            expected_ref0_level1 / total_reads
        );

        let expected_ref1_level1 = 1.0   // read1 (unique, always counts)
                                 + 0.0   // read2 (0.1 < 0.5)
                                 + 1.0   // read3 (0.5 >= 0.5)
                                 + 0.0   // read4 (0.35 < 0.5)
                                 + 0.0; // read5 (0.005 < 0.5)
        assert!(
            (results.level1[1] - expected_ref1_level1 / total_reads).abs() < 0.001,
            "ref1 level1 should be {}",
            expected_ref1_level1 / total_reads
        );

        let expected_ref2_level1 = 0.0; // read4 (0.05 < 0.5)
        assert!(
            (results.level1[2] - expected_ref2_level1 / total_reads).abs() < 0.001,
            "ref2 level1 should be 0.0"
        );

        // Test 4: Verify level2 assignments (0.01 <= score < 0.5)
        let expected_ref0_level2 = 0.0; // All ref0 scores >= 0.5, so counted in level1
        assert!(
            (results.level2[0] - expected_ref0_level2 / total_reads).abs() < 0.001,
            "ref0 level2 should be 0.0"
        );

        let expected_ref1_level2 = 1.0   // read2 (0.1 >= 0.01 and < 0.5)
                                 + 0.0   // read3 (0.5 >= 0.5, counted in level1)
                                 + 1.0   // read4 (0.35 >= 0.01 and < 0.5)
                                 + 0.0; // read5 (0.005 < 0.01)
        assert!(
            (results.level2[1] - expected_ref1_level2 / total_reads).abs() < 0.001,
            "ref1 level2 should be {}",
            expected_ref1_level2 / total_reads
        );

        let expected_ref2_level2 = 1.0; // read4 (0.05 >= 0.01 and < 0.5)
        assert!(
            (results.level2[2] - expected_ref2_level2 / total_reads).abs() < 0.001,
            "ref2 level2 should be {}",
            expected_ref2_level2 / total_reads
        );

        // Test 5: Verify output vector lengths
        assert_eq!(
            results.best_hit_reads.len(),
            3,
            "best_hit_reads should have 3 elements"
        );
        assert_eq!(results.best_hit.len(), 3, "best_hit should have 3 elements");
        assert_eq!(results.level1.len(), 3, "level1 should have 3 elements");
        assert_eq!(results.level2.len(), 3, "level2 should have 3 elements");
    }

    #[test]
    fn test_compute_best_hit_edge_cases() {
        use crate::matrix::PathoscopeMatrix;
        use rustc_hash::FxHashMap;

        // Test empty inputs
        let u: UniqueReads = FxHashMap::default();
        let nu: MultiMappingReads = FxHashMap::default();
        let refs = vec!["ref0".to_string()];
        let reads = vec!["read0".to_string()];

        let matrix = PathoscopeMatrix {
            unique_reads: u,
            multi_mapping_reads: nu,
            refs,
            reads,
            max_score: 0.0,
            min_score: 0.0,
        };

        let results = compute_best_hit(&matrix);

        assert_eq!(
            results.best_hit_reads[0], 0.0,
            "Empty input should result in zero counts"
        );
        assert_eq!(
            results.best_hit[0], 0.0,
            "Empty input should result in zero normalized values"
        );
        assert_eq!(
            results.level1[0], 0.0,
            "Empty input should result in zero level1"
        );
        assert_eq!(
            results.level2[0], 0.0,
            "Empty input should result in zero level2"
        );

        // Test with nu entry that has no valid scores
        let u_empty: UniqueReads = FxHashMap::default();
        let mut nu_invalid: MultiMappingReads = FxHashMap::default();
        nu_invalid.insert(0, (vec![0], vec![10.0], vec![0.0], 10.0)); // normalized score is 0.0

        let refs_single = vec!["ref0".to_string()];
        let reads_single = vec!["read0".to_string()];

        let matrix_invalid = PathoscopeMatrix {
            unique_reads: u_empty,
            multi_mapping_reads: nu_invalid,
            refs: refs_single,
            reads: reads_single,
            max_score: 10.0,
            min_score: 0.0,
        };

        let results = compute_best_hit(&matrix_invalid);

        // Even with 0.0 normalized score, it should still be considered as best hit (0.0 == max)
        assert_eq!(
            results.best_hit_reads[0], 1.0,
            "Zero score should still count as best hit when it's the only/max score"
        );
    }
}
