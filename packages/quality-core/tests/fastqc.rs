//! The crate against real FastQC 0.11.9.
//!
//! Each golden in `fixtures/` is a blob the *old* path produced: FastQC wrote
//! the report and `parseFastqcData` turned it into what a sample stored.
//! **Never edit a golden to match this crate's output, and never regenerate
//! one from this crate** — that converts a caught divergence into a permanent
//! one. `README.md` records where they came from and what producing another
//! would take.
//!
//! Three of the four cases assert exact equality, down to the bit. The fourth
//! is the one place the two are meant to disagree — see `binned_case` — and it
//! pins the disagreement rather than tolerating it.

use std::fs::read_to_string;
use std::io::Write;
use std::path::PathBuf;

use quality_core::{profile_fastq, Quality, QualityError};
use serde::Deserialize;
use tempfile::NamedTempFile;

#[derive(Deserialize)]
struct Golden {
    /// The `#Base` label of each row FastQC wrote, in order: `7` for a single
    /// position, `10-14` for a bin.
    #[serde(rename = "baseGroups")]
    base_groups: Vec<String>,

    quality: Quality,
}

fn fixture(name: &str) -> PathBuf {
    PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures")).join(name)
}

fn load(case: &str) -> Golden {
    let path = fixture(&format!("{case}.json"));
    let text = read_to_string(&path).unwrap_or_else(|err| {
        panic!("golden {} is readable: {err}", path.display());
    });

    serde_json::from_str(&text).expect("golden parses")
}

/// Compare by bits rather than by `==`. A tolerance would hide exactly the
/// drift these fixtures exist to catch, and every value on both sides went
/// through the same half-to-even rounding, so equality is the right bar.
fn assert_same_rows(actual: &[Vec<f64>], expected: &[Vec<f64>], label: &str) {
    assert_eq!(actual.len(), expected.len(), "{label}: row count");

    for (cycle, (left, right)) in actual.iter().zip(expected).enumerate() {
        assert_eq!(
            left.iter().map(|value| value.to_bits()).collect::<Vec<_>>(),
            right
                .iter()
                .map(|value| value.to_bits())
                .collect::<Vec<_>>(),
            "{label}: cycle {} is {left:?}, FastQC says {right:?}",
            cycle + 1
        );
    }
}

fn rows(values: &[[f64; 6]]) -> Vec<Vec<f64>> {
    values.iter().map(|row| row.to_vec()).collect()
}

fn composition_rows(values: &[[f64; 4]]) -> Vec<Vec<f64>> {
    values.iter().map(|row| row.to_vec()).collect()
}

fn assert_matches_fastqc(case: &str, input: &str) {
    let golden = load(case);
    let actual = profile_fastq(&fixture(input)).expect("input profiles");

    assert_eq!(actual.count, golden.quality.count, "{case}: count");
    assert_eq!(actual.encoding, golden.quality.encoding, "{case}: encoding");
    assert_eq!(actual.gc, golden.quality.gc, "{case}: gc");
    assert_eq!(actual.length, golden.quality.length, "{case}: length");
    assert_eq!(
        actual.sequences, golden.quality.sequences,
        "{case}: sequences"
    );

    assert_same_rows(
        &rows(&actual.bases),
        &rows(&golden.quality.bases),
        &format!("{case}: bases"),
    );
    assert_same_rows(
        &composition_rows(&actual.composition),
        &composition_rows(&golden.quality.composition),
        &format!("{case}: composition"),
    );
}

/// 400 reads of exactly 75bp — the longest read FastQC leaves ungrouped, so
/// every row is a single cycle on both sides and the blobs must be identical.
#[test]
fn unbinned_case_matches_fastqc_exactly() {
    assert_matches_fastqc("unbinned", "unbinned.fastq.gz");
}

/// Plain, uncompressed input, read lengths of 30, 55 and 75 in one file, and
/// the row-collapse rule: cycles 31-55 are covered by exactly 100 reads, which
/// is not *more* than 100, so FastQC reports `NaN` percentiles there and the
/// stored row is the mean repeated six times.
#[test]
fn variable_length_case_matches_fastqc_exactly() {
    let golden = load("variable");

    let collapsed = golden
        .quality
        .bases
        .iter()
        .filter(|row| row.iter().all(|value| *value == row[0]))
        .count();

    assert!(
        collapsed >= 45,
        "fixture no longer reaches the collapse rule: only {collapsed} rows collapsed"
    );

    assert_matches_fastqc("variable", "variable.fastq");
}

/// One cycle where every read is `N`. FastQC's composition denominator is
/// A+C+G+T, so that cycle divides zero by zero and emits four `NaN`s; the
/// stored row is four zeros.
#[test]
fn all_n_case_matches_fastqc_exactly() {
    let golden = load("all_n");

    assert_eq!(
        golden.quality.composition[19], [0.0; 4],
        "fixture no longer reaches the all-N rule"
    );

    assert_matches_fastqc("all_n", "all_n.fastq.gz");
}

/// Parse a `#Base` label into the zero-based cycle range it covers.
fn group_range(label: &str) -> (usize, usize) {
    match label.split_once('-') {
        Some((start, end)) => (
            start.parse::<usize>().expect("group start") - 1,
            end.parse::<usize>().expect("group end"),
        ),
        None => {
            let position = label.parse::<usize>().expect("group position");

            (position - 1, position)
        }
    }
}

fn mean_over<const N: usize>(rows: &[[f64; N]], start: usize, end: usize) -> [f64; N] {
    let mut totals = [0.0; N];

    for row in &rows[start..end] {
        for (total, value) in totals.iter_mut().zip(row) {
            *total += value;
        }
    }

    totals.map(|total| total / (end - start) as f64)
}

/// 400 reads of exactly 150bp, which FastQC groups in fives from position 10.
///
/// **This is the one deliberate divergence**, and this test is what pins it.
/// FastQC averages each group and repeats the result across the group's
/// members, so a stored blob holds runs of identical rows; this crate reports
/// every cycle. The relationship asserted here is the whole of the difference:
///
///   - the five fields that are not per-cycle are identical;
///   - the row count is identical, because the old parser expanded each
///     group back across its members;
///   - positions 1-9 are ungrouped even at this length, so they are identical;
///   - and every grouped row is the mean of the cycles this crate reports for
///     it, which is what makes the finer data a refinement of the coarser one
///     rather than a different measurement.
///
/// The tolerance is rounding alone: both sides round before they are compared
/// — three places for `bases`, one for `composition` — so an average of
/// rounded values can sit half a place off a rounded average.
#[test]
fn binned_case_diverges_only_by_fastqcs_grouping() {
    let golden = load("binned");
    let actual = profile_fastq(&fixture("binned.fastq.gz")).expect("input profiles");

    assert_eq!(actual.count, golden.quality.count);
    assert_eq!(actual.encoding, golden.quality.encoding);
    assert_eq!(actual.gc, golden.quality.gc);
    assert_eq!(actual.length, golden.quality.length);
    assert_eq!(actual.sequences, golden.quality.sequences);

    assert_eq!(actual.bases.len(), golden.quality.bases.len());
    assert_eq!(actual.composition.len(), golden.quality.composition.len());

    assert!(
        golden.base_groups.iter().any(|label| label.contains('-')),
        "fixture no longer reaches FastQC's grouping"
    );

    let mut grouped_rows = 0;
    let mut differing_rows = 0;

    for label in &golden.base_groups {
        let (start, end) = group_range(label);

        // Every member of a group carries the same values in the golden.
        for cycle in start..end {
            assert_eq!(
                golden.quality.bases[cycle], golden.quality.bases[start],
                "group {label} is not uniform in the golden"
            );
        }

        if end - start > 1 {
            grouped_rows += end - start;
        }

        for cycle in start..end {
            if actual.bases[cycle] != golden.quality.bases[cycle] {
                differing_rows += 1;
            }
        }

        let bases = mean_over(&actual.bases, start, end);

        for (column, (value, expected)) in
            bases.iter().zip(&golden.quality.bases[start]).enumerate()
        {
            assert!(
                (value - expected).abs() <= 0.0015,
                "bases {label} column {column}: cycles average to {value}, FastQC says {expected}"
            );
        }

        let composition = mean_over(&actual.composition, start, end);

        for (column, (value, expected)) in composition
            .iter()
            .zip(&golden.quality.composition[start])
            .enumerate()
        {
            assert!(
                (value - expected).abs() <= 0.15,
                "composition {label} column {column}: cycles average to {value}, FastQC says {expected}"
            );
        }
    }

    // Positions 1-9 are their own groups even at this read length.
    for cycle in 0..9 {
        assert_eq!(
            actual.bases[cycle],
            golden.quality.bases[cycle],
            "cycle {} is ungrouped and must match exactly",
            cycle + 1
        );
    }

    assert!(
        grouped_rows > 100,
        "fixture groups too little to be worth pinning: {grouped_rows} rows"
    );

    /* The divergence has to be real, or this test would pass just as happily
     * against an implementation that reproduced the binning. */
    assert!(
        differing_rows > 50,
        "only {differing_rows} rows differ from the binned golden; \
         is the binning being reproduced?"
    );
}

fn write_fastq(contents: &str) -> NamedTempFile {
    let mut file = NamedTempFile::new().expect("temp file");

    file.write_all(contents.as_bytes()).expect("write");
    file.flush().expect("flush");

    file
}

/// A record cut off mid-way is an error, not a short read.
///
/// Python's runner treated a FastQC killed part way through as a success and
/// parsed whatever landed on disk; this path has no such gap — a file that
/// does not parse fails the job.
#[test]
fn a_truncated_record_is_an_error() {
    let file = write_fastq("@read_0\nACGTACGT\n+\nIIIIIIII\n@read_1\nACGTACGT\n");

    assert!(matches!(
        profile_fastq(file.path()),
        Err(QualityError::Fastq(_))
    ));
}

#[test]
fn a_quality_line_of_the_wrong_length_is_an_error() {
    let file = write_fastq("@read_0\nACGTACGT\n+\nIIII\n");

    assert!(matches!(
        profile_fastq(file.path()),
        Err(QualityError::Fastq(_))
    ));
}

/// FASTA carries no quality scores, so there is no blob to build from it.
#[test]
fn fasta_input_is_an_error() {
    let file = write_fastq(">read_0\nACGTACGT\n");

    assert!(matches!(
        profile_fastq(file.path()),
        Err(QualityError::MissingQuality)
    ));
}

#[test]
fn a_missing_file_is_an_error() {
    assert!(profile_fastq(&fixture("does_not_exist.fastq")).is_err());
}
