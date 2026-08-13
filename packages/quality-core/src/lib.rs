//! Read quality statistics for one FASTQ file, as FastQC 0.11.9 computes them.
//!
//! This replaces FastQC in the create-sample workflow. It is not a general
//! reimplementation of the tool: it produces the seven fields of the `Quality`
//! blob a sample stores and nothing else — no HTML report, no adapter content,
//! no duplication estimate, no pass/warn/fail.
//!
//! **The definitions are FastQC's, not the textbook ones.** Its percentiles
//! are a cumulative walk over an integer histogram rather than an
//! interpolation, its %GC is integer division, its per-read mean quality
//! truncates the summed raw characters, and its base-composition denominator
//! excludes `N`. Each is documented where it is implemented, with the Java
//! file it came from. Do not "correct" any of them — the blob is compared
//! against ones Python's `create_sample` wrote.
//!
//! **One divergence is deliberate: this computes per cycle and does not bin.**
//! FastQC groups base positions once a read is longer than 75bp, reporting one
//! averaged row per group and repeating it across the group's members, so a
//! stored blob from a 301bp run holds runs of identical rows. The output here
//! is finer and the shape is unchanged. See `README.md`.

mod encoding;
mod profile;
mod round;

pub use encoding::PhredEncoding;
pub use profile::{profile_fastq, Quality, QualityProfiler};
pub use round::round_half_even;

use thiserror::Error;

/// Unified error type for the quality-core binary.
#[derive(Debug, Error)]
pub enum QualityError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("FASTQ error: {0}")]
    Fastq(#[from] needletail::errors::ParseError),

    /// A record with no quality line. FASTA input, in practice — the create
    /// sample workflow only ever hands this FASTQ, so it means the upload is
    /// not what the sample says it is.
    #[error("record has no quality scores; input must be FASTQ, not FASTA")]
    MissingQuality,

    /// FastQC throws `IllegalArgumentException` here rather than guessing, and
    /// so does this: with no offset there is no score, and a wrong one shifts
    /// every figure in the blob by a constant.
    #[error("no known quality encoding uses the character {0}")]
    UnknownEncoding(u8),
}
