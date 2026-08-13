//! Quality-score encoding detection, ported from FastQC's `PhredEncoding`.
//!
//! The name this resolves to is what lands in `Quality.encoding` verbatim, so
//! the strings below are part of the stored contract and not labels to
//! improve. The offset it resolves to decides every score in the blob: a
//! per-cycle mean, a percentile and a per-read mean are all a raw character
//! minus this number.
//!
//! Detection keys off the **lowest quality character in the whole file** —
//! there is no sampling and no heuristic beyond the thresholds below. FastQC
//! takes that minimum three separate times, once per module, and this takes it
//! once; the three always agreed, because they scan the same characters.

use crate::QualityError;

/// The lowest character any known encoding uses.
const MINIMUM_CHARACTER: u8 = 33;

/// The highest character any known encoding uses.
const MAXIMUM_CHARACTER: u8 = 126;

const SANGER_OFFSET: u8 = 33;
const ILLUMINA_1_3_OFFSET: u8 = 64;

/// A resolved quality encoding: the name stored in the blob, and the offset
/// subtracted from a raw character to get a Phred score.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PhredEncoding {
    name: &'static str,
    offset: u8,
}

impl PhredEncoding {
    /// Resolve the encoding from the lowest quality character observed.
    ///
    /// The `== ILLUMINA_1_3_OFFSET + 1` arm distinguishes Illumina 1.3 from
    /// 1.5 by the lowest score each permitted. Guessing wrong between them
    /// changes only the recorded name — both carry the same offset.
    pub fn detect(lowest_character: u8) -> Result<Self, QualityError> {
        if lowest_character < MINIMUM_CHARACTER {
            return Err(QualityError::UnknownEncoding(lowest_character));
        }

        if lowest_character < ILLUMINA_1_3_OFFSET {
            return Ok(Self {
                name: "Sanger / Illumina 1.9",
                offset: SANGER_OFFSET,
            });
        }

        if lowest_character == ILLUMINA_1_3_OFFSET + 1 {
            return Ok(Self {
                name: "Illumina 1.3",
                offset: ILLUMINA_1_3_OFFSET,
            });
        }

        if lowest_character <= MAXIMUM_CHARACTER {
            return Ok(Self {
                name: "Illumina 1.5",
                offset: ILLUMINA_1_3_OFFSET,
            });
        }

        Err(QualityError::UnknownEncoding(lowest_character))
    }

    pub fn name(&self) -> &'static str {
        self.name
    }

    pub fn offset(&self) -> u8 {
        self.offset
    }
}

#[cfg(test)]
mod tests {
    use super::{PhredEncoding, MAXIMUM_CHARACTER};
    use crate::QualityError;

    #[test]
    fn detects_sanger_across_its_whole_range() {
        for lowest in 33..64u8 {
            let encoding = PhredEncoding::detect(lowest).unwrap();

            assert_eq!(encoding.name(), "Sanger / Illumina 1.9");
            assert_eq!(encoding.offset(), 33);
        }
    }

    /// `@` is the boundary: one below is Sanger, one above is Illumina 1.3.
    #[test]
    fn detects_the_two_offset_64_encodings() {
        assert_eq!(PhredEncoding::detect(64).unwrap().name(), "Illumina 1.5");
        assert_eq!(PhredEncoding::detect(65).unwrap().name(), "Illumina 1.3");
        assert_eq!(PhredEncoding::detect(66).unwrap().name(), "Illumina 1.5");

        for lowest in 64..=MAXIMUM_CHARACTER {
            assert_eq!(PhredEncoding::detect(lowest).unwrap().offset(), 64);
        }
    }

    #[test]
    fn rejects_characters_below_every_known_encoding() {
        assert!(matches!(
            PhredEncoding::detect(32),
            Err(QualityError::UnknownEncoding(32))
        ));
    }

    /// A file with no reads leaves FastQC's `lowestChar` at its initial 126,
    /// which resolves rather than failing. Reproduced so an empty upload
    /// produces the blob FastQC's own report would have parsed to.
    #[test]
    fn resolves_the_initial_lowest_character() {
        assert_eq!(
            PhredEncoding::detect(MAXIMUM_CHARACTER).unwrap().name(),
            "Illumina 1.5"
        );
    }
}
