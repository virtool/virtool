//! The single streaming pass, and the blob it produces.
//!
//! Every figure here is a port of FastQC 0.11.9, and the file-by-file
//! provenance is worth keeping to hand, because none of these definitions is
//! the obvious one:
//!
//! | Field | FastQC source |
//! | --- | --- |
//! | `bases` | `Modules/PerBaseQualityScores.java`, `Utilities/QualityCount.java` |
//! | `composition` | `Modules/PerBaseSequenceContent.java` |
//! | `count`, `gc`, `length`, `encoding` | `Modules/BasicStats.java` |
//! | `sequences` | `Modules/PerSequenceQualityScores.java` |
//!
//! Nothing is buffered. A read file runs to gigabytes, so the accumulators
//! below are the only thing that grows, and they grow with the *longest read*
//! rather than with the number of them.

use std::path::Path;

use needletail::parse_fastx_file;
use serde::{Deserialize, Serialize};

use crate::encoding::PhredEncoding;
use crate::round::round_half_even;
use crate::QualityError;

/// The width of FastQC's per-position quality histogram.
///
/// `QualityCount` allocates `new long[150]`, which covers every character a
/// supported encoding can carry — the highest is 126, and the highest offset
/// is 64. A character outside it is rejected by encoding detection before it
/// can be counted.
const QUALITY_SLOTS: usize = 150;

/// The length of the per-read mean quality histogram in the stored blob.
///
/// Python fixes it at 50 and drops any score at or above that rather than
/// growing the array, and every chart in the SPA is drawn against 50 columns.
const SEQUENCE_SCORE_SLOTS: usize = 50;

/// The read depth a cycle needs before FastQC will report percentiles for it.
///
/// `PerBaseQualityScores.getPercentile` skips any position whose total count
/// is not **greater** than this, and returns `NaN` when that leaves it nothing
/// to average. See `base_row` for what the stored blob does with such a cycle.
const PERCENTILE_MINIMUM_COUNT: u64 = 100;

/// A sample's quality data, in the shape `legacy_samples.quality` stores.
///
/// Field for field the `Quality` object in `packages/contracts/src/samples.ts`.
/// The column orders inside `bases` and `composition` are load-bearing — the
/// d3 charts index them positionally — and are stated at each builder below.
/// `Deserialize` is here for the golden tests, which read blobs FastQC and
/// `parseFastqcData` produced and compare them against this crate's.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Quality {
    pub bases: Vec<[f64; 6]>,
    pub composition: Vec<[f64; 4]>,
    pub count: u64,
    pub encoding: String,

    /// GC content as a **percentage**, and as a whole number.
    ///
    /// FastQC computes it with long division — `((g + c) * 100) / (a + t + g +
    /// c)` — so the figure it reports has already lost its fraction before
    /// anything reads it. Storing a float here would not recover the
    /// precision; it would only disagree with every blob Python wrote.
    pub gc: u64,

    pub length: [usize; 2],
    pub sequences: Vec<u64>,
}

/// Per-cycle quality histogram — FastQC's `QualityCount`.
#[derive(Clone)]
struct CycleQuality {
    counts: [u64; QUALITY_SLOTS],
    total: u64,
}

impl CycleQuality {
    fn new() -> Self {
        Self {
            counts: [0; QUALITY_SLOTS],
            total: 0,
        }
    }

    fn add(&mut self, character: u8) {
        self.total += 1;
        self.counts[character as usize] += 1;
    }

    /// The mean score at this cycle.
    ///
    /// The walk starts at `offset` rather than at zero, which is FastQC's:
    /// characters below the offset count toward neither the total nor the
    /// divisor. No such character can exist here — the offset is derived from
    /// the lowest character in the file — but the shape is kept so the two
    /// implementations cannot drift if that ever stops being true.
    fn mean(&self, offset: u8) -> f64 {
        let mut total = 0u64;
        let mut count = 0u64;

        for (character, &occurrences) in
            self.counts.iter().enumerate().skip(offset as usize)
        {
            total += occurrences * (character as u64 - offset as u64);
            count += occurrences;
        }

        if count == 0 {
            return 0.0;
        }

        total as f64 / count as f64
    }

    /// The `percentile`th score at this cycle.
    ///
    /// A cumulative walk over the integer histogram, **not** an interpolated
    /// percentile: the target rank is `total * percentile / 100` in integer
    /// arithmetic, and the answer is the first score at which the running
    /// count reaches it. So every value this returns is a whole number, which
    /// is why a stored median reads as `34.0` and never `33.5` unless binning
    /// averaged several cycles together.
    fn percentile(&self, offset: u8, percentile: u64) -> f64 {
        let target = self.total * percentile / 100;
        let mut count = 0u64;

        for (character, &occurrences) in
            self.counts.iter().enumerate().skip(offset as usize)
        {
            count += occurrences;

            if count >= target {
                return (character as u64 - offset as u64) as f64;
            }
        }

        -1.0
    }
}

/// Per-cycle base composition. `N` and lower-case letters are counted by
/// neither field, which is what puts them outside the percentage denominator.
#[derive(Clone, Copy, Default)]
struct CycleBases {
    a: u64,
    c: u64,
    g: u64,
    t: u64,
}

/// The accumulator for one FASTQ file.
pub struct QualityProfiler {
    cycles: Vec<CycleQuality>,
    bases: Vec<CycleBases>,
    read_scores: [u64; QUALITY_SLOTS],
    count: u64,
    minimum_length: usize,
    maximum_length: usize,
    totals: CycleBases,
    lowest_character: u8,
}

impl Default for QualityProfiler {
    fn default() -> Self {
        Self::new()
    }
}

impl QualityProfiler {
    pub fn new() -> Self {
        Self {
            cycles: Vec::new(),
            bases: Vec::new(),
            read_scores: [0; QUALITY_SLOTS],
            count: 0,
            minimum_length: 0,
            maximum_length: 0,
            totals: CycleBases::default(),
            // FastQC seeds this with the highest character any encoding uses
            // and only ever lowers it, so a file with no reads still resolves.
            lowest_character: 126,
        }
    }

    /// Fold one read into the accumulators.
    ///
    /// `sequence` and `quality` are taken separately and are never assumed to
    /// be the same length, because FastQC's four modules read one or the other
    /// and none of them compares the two.
    pub fn process(&mut self, sequence: &[u8], quality: &[u8]) {
        self.count += 1;

        if self.count == 1 {
            self.minimum_length = sequence.len();
            self.maximum_length = sequence.len();
        } else {
            self.minimum_length = self.minimum_length.min(sequence.len());
            self.maximum_length = self.maximum_length.max(sequence.len());
        }

        if self.bases.len() < sequence.len() {
            self.bases.resize(sequence.len(), CycleBases::default());
        }

        for (cycle, &base) in self.bases.iter_mut().zip(sequence) {
            match base {
                b'G' => {
                    cycle.g += 1;
                    self.totals.g += 1;
                }
                b'A' => {
                    cycle.a += 1;
                    self.totals.a += 1;
                }
                b'T' => {
                    cycle.t += 1;
                    self.totals.t += 1;
                }
                b'C' => {
                    cycle.c += 1;
                    self.totals.c += 1;
                }
                _ => {}
            }
        }

        if self.cycles.len() < quality.len() {
            self.cycles.resize(quality.len(), CycleQuality::new());
        }

        let mut read_total = 0u64;

        for (cycle, &character) in self.cycles.iter_mut().zip(quality) {
            cycle.add(character);
            read_total += character as u64;

            if character < self.lowest_character {
                self.lowest_character = character;
            }
        }

        /* The per-read mean is an integer division of the summed **raw**
         * characters, so it truncates before the offset is ever subtracted.
         * Averaging the scores instead — the same figure computed the obvious
         * way — lands a read on a neighbouring column often enough to be
         * visible in the chart. */
        if !quality.is_empty() {
            self.read_scores[(read_total / quality.len() as u64) as usize] += 1;
        }
    }

    /// Resolve the accumulators into the stored blob.
    pub fn finish(&self) -> Result<Quality, QualityError> {
        let encoding = PhredEncoding::detect(self.lowest_character)?;
        let offset = encoding.offset();

        Ok(Quality {
            bases: self
                .cycles
                .iter()
                .map(|cycle| base_row(cycle, offset))
                .collect(),
            composition: self.bases.iter().map(composition_row).collect(),
            count: self.count,
            encoding: encoding.name().to_string(),
            gc: gc_percentage(&self.totals),
            length: [self.minimum_length, self.maximum_length],
            sequences: self.sequence_scores(offset),
        })
    }

    fn sequence_scores(&self, offset: u8) -> Vec<u64> {
        let mut scores = vec![0u64; SEQUENCE_SCORE_SLOTS];

        for (character, &occurrences) in self.read_scores.iter().enumerate() {
            if occurrences == 0 || character < offset as usize {
                continue;
            }

            // Scores at or above 50 are dropped rather than growing the array.
            if let Some(slot) = scores.get_mut(character - offset as usize) {
                *slot += occurrences;
            }
        }

        scores
    }
}

/// One row of `bases`: mean, median, lower quartile, upper quartile, 10th
/// percentile, 90th percentile — the order `Bases.ts` reads by index.
///
/// **A cycle without enough reads collapses to its mean.** FastQC reports the
/// five percentiles as `NaN` for a position covered by 100 reads or fewer, and
/// a `NaN` cannot be stored — it is not valid JSON, and both the JSONB column
/// and the `Quality` schema reject it. Python's parser resolves such a row by
/// substituting the first value in it that did parse, which is the mean, for
/// every value in the row. That substitution is reproduced here rather than
/// left to a parser this path no longer goes through.
///
/// It is not a rare shape. A file of variable-length reads thins out toward
/// its longest read, so the last cycles of a real MiSeq run reach it.
fn base_row(cycle: &CycleQuality, offset: u8) -> [f64; 6] {
    let mean = cycle.mean(offset);

    let row = if cycle.total > PERCENTILE_MINIMUM_COUNT {
        [
            mean,
            cycle.percentile(offset, 50),
            cycle.percentile(offset, 25),
            cycle.percentile(offset, 75),
            cycle.percentile(offset, 10),
            cycle.percentile(offset, 90),
        ]
    } else {
        [mean; 6]
    };

    row.map(|value| round_half_even(value, 3))
}

/// One row of `composition`: %G, %A, %T, %C — the order FastQC writes them in,
/// which is neither alphabetical nor the order it holds them in memory.
///
/// **The denominator is A+C+G+T, so `N` is excluded.** A cycle at which every
/// read is `N` therefore divides zero by zero, and FastQC emits four `NaN`s.
/// Zero is stored instead: it cannot be `NaN` for the reasons in `base_row`,
/// and it is the honest reading — no A, C, G or T was observed there.
fn composition_row(cycle: &CycleBases) -> [f64; 4] {
    let total = cycle.a + cycle.c + cycle.g + cycle.t;

    if total == 0 {
        return [0.0; 4];
    }

    [cycle.g, cycle.a, cycle.t, cycle.c]
        .map(|count| round_half_even((count as f64 / total as f64) * 100.0, 1))
}

/// Whole-file GC content, as FastQC's Basic Statistics computes it: integer
/// division, over a denominator that excludes `N`.
fn gc_percentage(totals: &CycleBases) -> u64 {
    let total = totals.a + totals.t + totals.g + totals.c;

    if total == 0 {
        return 0;
    }

    (totals.g + totals.c) * 100 / total
}

/// Read one FASTQ file — gzipped or plain — and resolve its quality blob.
///
/// One file per invocation, deliberately. Pairing two mates into the composite
/// a sample stores is `compositeQuality`'s, in `packages/bio`, which is tested
/// against Python and is not reimplemented here.
pub fn profile_fastq(path: &Path) -> Result<Quality, QualityError> {
    let mut reader = parse_fastx_file(path)?;
    let mut profiler = QualityProfiler::new();

    while let Some(record) = reader.next() {
        let record = record?;
        let quality = record.qual().ok_or(QualityError::MissingQuality)?;

        profiler.process(&record.seq(), quality);
    }

    profiler.finish()
}

#[cfg(test)]
mod tests {
    use super::{
        composition_row, gc_percentage, CycleBases, CycleQuality, QualityProfiler,
    };

    /// Build a cycle whose scores are `score` repeated `count` times, at the
    /// Sanger offset.
    fn cycle_of(score: u8, count: u64) -> CycleQuality {
        let mut cycle = CycleQuality::new();

        for _ in 0..count {
            cycle.add(33 + score);
        }

        cycle
    }

    #[test]
    fn mean_excludes_nothing_when_every_character_is_at_or_above_the_offset() {
        let mut cycle = CycleQuality::new();

        cycle.add(33 + 30);
        cycle.add(33 + 40);

        assert_eq!(cycle.mean(33), 35.0);
    }

    /// The target rank truncates, and the answer is the first score whose
    /// running count reaches it — never an interpolation between two scores.
    #[test]
    fn percentile_walks_the_histogram_cumulatively() {
        let mut cycle = CycleQuality::new();

        for _ in 0..300 {
            cycle.add(33 + 20);
        }
        for _ in 0..700 {
            cycle.add(33 + 40);
        }

        // rank 250 falls inside the 300 reads scoring 20.
        assert_eq!(cycle.percentile(33, 25), 20.0);
        // rank 500 falls past them, into the 40s.
        assert_eq!(cycle.percentile(33, 50), 40.0);
        assert_eq!(cycle.percentile(33, 90), 40.0);
    }

    /// Exactly 100 reads is not *more* than 100, so the percentile columns are
    /// `NaN` in FastQC and collapse onto the mean here — even though this cycle
    /// holds two distinct scores whose percentiles would differ.
    #[test]
    fn a_shallow_cycle_reports_its_mean_in_every_column() {
        let mut cycle = cycle_of(20, 50);
        for _ in 0..50 {
            cycle.add(33 + 40);
        }

        assert_eq!(super::base_row(&cycle, 33), [30.0; 6]);
    }

    /// One more read is all it takes to cross the threshold, at which point
    /// the five columns become percentiles and stop matching the mean.
    #[test]
    fn a_deep_enough_cycle_reports_percentiles() {
        let mut cycle = cycle_of(20, 50);
        for _ in 0..51 {
            cycle.add(33 + 40);
        }

        let row = super::base_row(&cycle, 33);

        // (50 * 20 + 51 * 40) / 101, rounded to three places.
        assert_eq!(row[0], 30.099);
        // Ranks 50, 25 and 10 all fall inside the 50 reads scoring 20; ranks
        // 75 and 90 fall past them.
        assert_eq!(row, [30.099, 20.0, 20.0, 40.0, 20.0, 40.0]);
    }

    #[test]
    fn composition_orders_columns_g_a_t_c() {
        let row = composition_row(&CycleBases {
            g: 1,
            a: 2,
            t: 3,
            c: 4,
        });

        assert_eq!(row, [10.0, 20.0, 30.0, 40.0]);
    }

    /// An all-`N` cycle divides zero by zero in FastQC and stores as zeros.
    #[test]
    fn an_all_n_cycle_composes_as_zeros() {
        assert_eq!(composition_row(&CycleBases::default()), [0.0; 4]);
    }

    #[test]
    fn composition_denominator_excludes_n() {
        let mut profiler = QualityProfiler::new();

        profiler.process(b"GN", b"II");

        let quality = profiler.finish().unwrap();

        // Cycle one is all G; cycle two counted no A, C, G or T at all.
        assert_eq!(quality.composition[0], [100.0, 0.0, 0.0, 0.0]);
        assert_eq!(quality.composition[1], [0.0; 4]);
    }

    /// Integer division, so 1 G in 3 bases is 33 and never 33.3.
    #[test]
    fn gc_truncates() {
        assert_eq!(
            gc_percentage(&CycleBases {
                g: 1,
                a: 1,
                t: 1,
                c: 0
            }),
            33
        );

        assert_eq!(gc_percentage(&CycleBases::default()), 0);
    }

    #[test]
    fn length_is_the_observed_range() {
        let mut profiler = QualityProfiler::new();

        profiler.process(b"ACGTA", b"IIIII");
        profiler.process(b"ACG", b"III");
        profiler.process(b"ACGTACG", b"IIIIIII");

        let quality = profiler.finish().unwrap();

        assert_eq!(quality.length, [3, 7]);
        assert_eq!(quality.count, 3);
    }

    /// The per-read mean truncates the summed raw characters before the offset
    /// comes off, which is not the same as the mean of the scores.
    #[test]
    fn sequence_scores_truncate_the_raw_mean() {
        let mut profiler = QualityProfiler::new();

        // `!` is raw 33, which is what pins the encoding at Sanger.
        profiler.process(b"A", b"!");
        // Raw 73 and 74; their raw mean truncates to 73, a score of 40.
        profiler.process(b"AC", b"IJ");

        let quality = profiler.finish().unwrap();

        assert_eq!(quality.encoding, "Sanger / Illumina 1.9");
        assert_eq!(quality.sequences.len(), 50);
        assert_eq!(quality.sequences[0], 1);
        assert_eq!(quality.sequences[40], 1);
        assert_eq!(quality.sequences.iter().sum::<u64>(), 2);
    }

    /// A score of 50 or more is dropped rather than growing the array.
    #[test]
    fn sequence_scores_drop_anything_past_the_last_slot() {
        let mut profiler = QualityProfiler::new();

        // `!` pins the offset at 33; `~` is raw 126, a score of 93.
        profiler.process(b"A", b"!");
        profiler.process(b"A", b"~");

        let quality = profiler.finish().unwrap();

        assert_eq!(quality.sequences.len(), 50);
        assert_eq!(quality.sequences[0], 1);
        assert_eq!(quality.sequences.iter().sum::<u64>(), 1);
    }

    #[test]
    fn cycles_grow_to_the_longest_read() {
        let mut profiler = QualityProfiler::new();

        profiler.process(b"AC", b"II");
        profiler.process(b"ACGT", b"IIII");
        profiler.process(b"A", b"I");

        let quality = profiler.finish().unwrap();

        assert_eq!(quality.bases.len(), 4);
        assert_eq!(quality.composition.len(), 4);
    }

    /// A file with no reads resolves rather than failing, matching what
    /// FastQC's own report would have parsed to.
    #[test]
    fn an_empty_file_resolves_to_an_empty_blob() {
        let quality = QualityProfiler::new().finish().unwrap();

        assert_eq!(quality.count, 0);
        assert_eq!(quality.gc, 0);
        assert_eq!(quality.length, [0, 0]);
        assert!(quality.bases.is_empty());
        assert!(quality.composition.is_empty());
        assert_eq!(quality.sequences, vec![0; 50]);
    }

    /// One low character anywhere in the file decides the encoding for all of
    /// it, which is why a file of nothing but high scores reads as Illumina.
    #[test]
    fn encoding_follows_the_lowest_character_in_the_file() {
        let mut sanger = QualityProfiler::new();
        sanger.process(b"AA", b"I#");

        assert_eq!(sanger.finish().unwrap().encoding, "Sanger / Illumina 1.9");

        let mut illumina_1_3 = QualityProfiler::new();
        illumina_1_3.process(b"AA", b"hA");

        assert_eq!(illumina_1_3.finish().unwrap().encoding, "Illumina 1.3");

        let mut illumina_1_5 = QualityProfiler::new();
        illumina_1_5.process(b"AA", b"hh");

        assert_eq!(illumina_1_5.finish().unwrap().encoding, "Illumina 1.5");
    }
}
