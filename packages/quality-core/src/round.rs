//! Half-to-even rounding, matching Python's built-in `round`.
//!
//! Every figure in the output blob is rounded here, and the result is stored
//! and compared across three implementations — Python's `create_sample`, the
//! TypeScript `roundHalfEven` in `packages/bio/src/fastqc.ts`, and this one. A
//! rounding rule that disagrees with either of the others is a divergence in
//! the stored data, not a cosmetic difference.
//!
//! Naive scaling (`(value * 1000.0).round() / 1000.0`) is wrong twice over:
//! `f64::round` rounds half *away from zero*, and the multiply introduces its
//! own error, which is what makes it disagree with Python on values such as
//! `2.675` whose stored double sits fractionally below the decimal midpoint.
//!
//! So this decomposes the double into `mantissa * 2^exponent` and compares
//! against the midpoint in exact integer arithmetic, exactly as the TypeScript
//! does with `BigInt`.

/// The number of fractional bits in an IEEE-754 double.
const MANTISSA_BITS: u32 = 52;

/// Beyond this many halvings the value is smaller than any representable
/// rounding decision at the digit counts this crate uses, and the shift that
/// would build the denominator overflows a `u128`.
const NEGLIGIBLE_EXPONENT: i32 = -127;

/// Round `value` to `digits` decimal places, half-to-even.
///
/// Non-finite values and zero are returned unchanged, matching the TypeScript.
pub fn round_half_even(value: f64, digits: u32) -> f64 {
    if !value.is_finite() || value == 0.0 {
        return value;
    }

    let negative = value < 0.0;
    let absolute = value.abs();

    let bits = absolute.to_bits();
    let raw_exponent = ((bits >> MANTISSA_BITS) & 0x7ff) as i32;
    let raw_mantissa = bits & ((1u64 << MANTISSA_BITS) - 1);

    // A subnormal has no implicit leading bit and a fixed exponent.
    let (mantissa, exponent) = if raw_exponent == 0 {
        (raw_mantissa as u128, -1074)
    } else {
        (
            (raw_mantissa | (1u64 << MANTISSA_BITS)) as u128,
            raw_exponent - 1075,
        )
    };

    /* A non-negative exponent means `mantissa * 2^exponent` is a whole number,
     * which is already its own rounding at any number of decimal places. The
     * general path below would reach the same answer, but only after a shift
     * wide enough to overflow. */
    if exponent >= 0 {
        return value;
    }

    if exponent <= NEGLIGIBLE_EXPONENT {
        return if negative { -0.0 } else { 0.0 };
    }

    let scale = 10u128.pow(digits);
    let numerator = mantissa * scale;
    let denominator = 1u128 << (-exponent);

    let mut quotient = numerator / denominator;
    let twice_remainder = (numerator - quotient * denominator) * 2;

    // Above the midpoint always rounds up; exactly on it rounds to the even
    // neighbour, which is what makes this half-to-even rather than half-up.
    if twice_remainder > denominator
        || (twice_remainder == denominator && quotient % 2 == 1)
    {
        quotient += 1;
    }

    let rounded = quotient as f64 / scale as f64;

    if negative {
        -rounded
    } else {
        rounded
    }
}

#[cfg(test)]
mod tests {
    use super::round_half_even;

    /// The midpoint cases are the whole point: each of these has Python's
    /// `round` choosing the even neighbour where `f64::round` would not.
    #[test]
    fn rounds_exact_midpoints_to_even() {
        assert_eq!(round_half_even(0.5, 0), 0.0);
        assert_eq!(round_half_even(1.5, 0), 2.0);
        assert_eq!(round_half_even(2.5, 0), 2.0);
        assert_eq!(round_half_even(3.5, 0), 4.0);
        assert_eq!(round_half_even(62.5, 0), 62.0);
        assert_eq!(round_half_even(0.125, 2), 0.12);
        assert_eq!(round_half_even(0.375, 2), 0.38);
    }

    /// `2.675` is the canonical case for why the decision is made against the
    /// binary value rather than the decimal literal: the stored double is
    /// 2.67499999999999982236431605997495353221893310546875, so Python rounds
    /// it down and a scale-and-round implementation rounds it up.
    #[test]
    fn rounds_against_the_binary_value_not_the_literal() {
        assert_eq!(round_half_even(2.675, 2), 2.67);
        assert_eq!(round_half_even(1.005, 2), 1.0);
        assert_eq!(round_half_even(8.475, 2), 8.47);
    }

    #[test]
    fn rounds_at_the_digit_counts_the_blob_uses() {
        assert_eq!(round_half_even(37.406490000000005, 3), 37.406);
        assert_eq!(round_half_even(26.266967329347068, 3), 26.267);
        assert_eq!(round_half_even(24.530524955915276, 3), 24.531);
        assert_eq!(round_half_even(20.55, 1), 20.6);
        assert_eq!(round_half_even(33.333333333333336, 1), 33.3);
    }

    #[test]
    fn leaves_values_that_need_no_rounding_alone() {
        assert_eq!(round_half_even(34.0, 3), 34.0);
        assert_eq!(round_half_even(0.0, 3), 0.0);
        assert_eq!(round_half_even(100.0, 1), 100.0);
    }

    #[test]
    fn handles_negatives_symmetrically() {
        assert_eq!(round_half_even(-2.5, 0), -2.0);
        assert_eq!(round_half_even(-3.5, 0), -4.0);

        // Not a midpoint despite how it reads: the stored double is
        // -37.40650000000000119..., which is above it. Python agrees.
        assert_eq!(round_half_even(-37.4065, 3), -37.407);
        assert_eq!(round_half_even(37.4065, 3), 37.407);
    }

    /// Whole numbers take the early return above; the result must still be the
    /// value itself rather than anything the general path would have to build.
    #[test]
    fn returns_large_whole_numbers_unchanged() {
        let large = 9.007199254740992e15;

        assert_eq!(round_half_even(large, 3), large);
    }

    #[test]
    fn flushes_negligible_magnitudes_to_zero() {
        assert_eq!(round_half_even(1e-300, 3), 0.0);
        assert_eq!(round_half_even(f64::MIN_POSITIVE, 3), 0.0);
    }

    #[test]
    fn passes_non_finite_values_through() {
        assert!(round_half_even(f64::NAN, 3).is_nan());
        assert_eq!(round_half_even(f64::INFINITY, 3), f64::INFINITY);
    }
}
