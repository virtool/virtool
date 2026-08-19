//! `round_half_even` against the frozen table in `fixtures/rounding.jsonl`.
//!
//! Each case states the correct half-to-even rounding of the exact binary
//! value of a double. **Never edit a case to match this implementation's
//! output.** That converts a caught divergence into a permanent one, and the
//! whole point of the fixture is that the rounding is right on every value the
//! stored blob can hold.

use std::fs::read_to_string;

use quality_core::round_half_even;
use serde::Deserialize;

#[derive(Deserialize)]
struct Case {
    value: f64,
    digits: u32,
    expected: f64,
}

#[test]
fn matches_the_frozen_table_on_every_case() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/rounding.jsonl");
    let text = read_to_string(path).expect("rounding fixture is readable");

    let cases: Vec<Case> = text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("case parses"))
        .collect();

    assert!(cases.len() > 2000, "fixture is suspiciously small");

    for case in &cases {
        let actual = round_half_even(case.value, case.digits);

        /* Compared by bits rather than by `==`, which would let a sign
         * disagreement on zero through: rounding `-0.0001` to two places is
         * `-0.0`, and `0.0 == -0.0`. */
        assert_eq!(
            actual.to_bits(),
            case.expected.to_bits(),
            "round({}, {}) is {}, expected {}",
            case.value,
            case.digits,
            actual,
            case.expected
        );
    }
}
