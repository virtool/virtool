//! Assert the CLI reproduces the golden-vector corpus exactly.
//!
//! The corpus in `tests/golden/vectors.json` was captured from the PyO3 build
//! of `workflow-pathoscope` before the crate moved here — see
//! `tests/golden/generate.py`. This port is meant to be behaviour-preserving
//! bug-for-bug, so every value has to match, floats included.
//!
//! Floats are compared with `f64::to_bits`, not with a tolerance and not as
//! text. "Equivalent within tolerance" is not the bar for a diagnostic
//! workflow, and comparing the rendered text would fail on a harmless
//! difference between Python's and Rust's float formatters while saying
//! nothing about the values.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;
use sha2::{Digest, Sha256};

const BIN: &str = env!("CARGO_BIN_EXE_pathoscope-core");

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn corpus() -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/golden/vectors.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|err| panic!("reading {}: {err}", path.display()));

    serde_json::from_str(&text).expect("vectors.json is not valid JSON")
}

fn sha256(path: &Path) -> String {
    let bytes = std::fs::read(path)
        .unwrap_or_else(|err| panic!("reading {}: {err}", path.display()));

    format!("{:x}", Sha256::digest(bytes))
}

fn floats(value: &Value, field: &str) -> Vec<f64> {
    value[field]
        .as_array()
        .unwrap_or_else(|| panic!("{field} is not an array"))
        .iter()
        .map(|entry| {
            entry
                .as_f64()
                .unwrap_or_else(|| panic!("{field} holds a non-numeric entry"))
        })
        .collect()
}

fn strings(value: &Value, field: &str) -> Vec<String> {
    value[field]
        .as_array()
        .unwrap_or_else(|| panic!("{field} is not an array"))
        .iter()
        .map(|entry| entry.as_str().expect("expected a string").to_string())
        .collect()
}

/// Compare two float arrays bit for bit.
fn assert_floats_identical(name: &str, field: &str, expected: &[f64], actual: &[f64]) {
    assert_eq!(
        expected.len(),
        actual.len(),
        "{name}: {field} has {} entries, expected {}",
        actual.len(),
        expected.len()
    );

    for (index, (want, got)) in expected.iter().zip(actual).enumerate() {
        assert_eq!(
            want.to_bits(),
            got.to_bits(),
            "{name}: {field}[{index}] is {got:?} ({:#018x}), expected {want:?} ({:#018x})",
            got.to_bits(),
            want.to_bits()
        );
    }
}

/// Rebuild a dense coverage array from the corpus's sparse encoding.
fn dense_coverage(sparse: &Value) -> Vec<u64> {
    let length = sparse["length"].as_u64().expect("coverage length") as usize;
    let mut dense = vec![0u64; length];

    for (index, value) in sparse["nonzero"].as_object().expect("coverage nonzero") {
        let index: usize = index.parse().expect("coverage index is not an integer");
        dense[index] = value.as_u64().expect("coverage value is not an integer");
    }

    dense
}

fn run(args: &[String]) -> std::process::Output {
    Command::new(BIN)
        .args(args)
        .output()
        .expect("failed to run pathoscope-core")
}

fn assert_stdout_empty(name: &str, output: &std::process::Output) {
    assert!(
        output.stdout.is_empty(),
        "{name}: stdout must be empty, got {:?}",
        String::from_utf8_lossy(&output.stdout)
    );
}

fn check_em(name: &str, vector: &Value, out_dir: &Path) {
    let alignment = fixtures().join(vector["args"]["alignment"].as_str().unwrap());
    let cutoff = vector["args"]["p_score_cutoff"].as_f64().unwrap();
    let output = out_dir.join(format!("{name}.json"));

    let result = run(&[
        "em".into(),
        "--alignment".into(),
        alignment.to_string_lossy().into_owned(),
        "--p-score-cutoff".into(),
        cutoff.to_string(),
        "--output".into(),
        output.to_string_lossy().into_owned(),
    ]);

    assert_stdout_empty(name, &result);

    if vector.get("expect_failure").and_then(Value::as_bool) == Some(true) {
        assert!(
            !result.status.success(),
            "{name}: expected a non-zero exit for a malformed input, got success"
        );

        return;
    }

    assert!(
        result.status.success(),
        "{name}: exited {:?}\nstderr: {}",
        result.status.code(),
        String::from_utf8_lossy(&result.stderr)
    );

    let actual: Value =
        serde_json::from_str(&std::fs::read_to_string(&output).expect("results file"))
            .expect("results file is not valid JSON");
    let expected = &vector["result"];

    for field in [
        "best_hit_initial_reads",
        "best_hit_initial",
        "level_1_initial",
        "level_2_initial",
        "best_hit_final_reads",
        "best_hit_final",
        "level_1_final",
        "level_2_final",
        "init_pi",
        "pi",
    ] {
        assert_floats_identical(
            name,
            field,
            &floats(expected, field),
            &floats(&actual, field),
        );
    }

    assert_eq!(
        strings(expected, "refs"),
        strings(&actual, "refs"),
        "{name}: refs differs"
    );

    // The corpus records the read *names* the PyO3 build returned, because that
    // is what it returned; the results carry only their number now. Comparing
    // the count against the recorded array's length pins the same figure, so
    // the corpus stays exactly as Python wrote it.
    assert_eq!(
        strings(expected, "reads").len() as u64,
        actual["read_count"].as_u64().expect("read_count"),
        "{name}: read_count differs from the number of recorded reads"
    );

    let expected_coverage = expected["coverage"].as_object().expect("coverage");
    let actual_coverage = actual["coverage"].as_object().expect("coverage");

    assert_eq!(
        expected_coverage.keys().collect::<Vec<_>>(),
        actual_coverage.keys().collect::<Vec<_>>(),
        "{name}: coverage is keyed by different references"
    );

    for (reference, sparse) in expected_coverage {
        let want = dense_coverage(sparse);
        let got: Vec<u64> = actual_coverage[reference]
            .as_array()
            .expect("coverage array")
            .iter()
            .map(|entry| entry.as_u64().expect("coverage entry"))
            .collect();

        assert_eq!(
            want.len(),
            got.len(),
            "{name}: coverage[{reference}] has {} entries, expected {}",
            got.len(),
            want.len()
        );

        for (index, (want, got)) in want.iter().zip(&got).enumerate() {
            assert_eq!(
                want, got,
                "{name}: coverage[{reference}][{index}] is {got}, expected {want}"
            );
        }
    }
}

fn check_eliminate_subtraction(name: &str, vector: &Value, out_dir: &Path) {
    let args = &vector["args"];
    let out_alignments = out_dir.join(format!("{name}.bam"));
    let out_fastq = out_dir.join(format!("{name}.fq"));
    let output = out_dir.join(format!("{name}.json"));

    let result = run(&[
        "eliminate-subtraction".into(),
        "--isolate-alignments".into(),
        fixtures()
            .join(args["isolate_alignments"].as_str().unwrap())
            .to_string_lossy()
            .into_owned(),
        "--subtraction-alignments".into(),
        fixtures()
            .join(args["subtraction_alignments"].as_str().unwrap())
            .to_string_lossy()
            .into_owned(),
        "--output-alignments".into(),
        out_alignments.to_string_lossy().into_owned(),
        "--input-fastq".into(),
        fixtures()
            .join(args["input_fastq"].as_str().unwrap())
            .to_string_lossy()
            .into_owned(),
        "--output-fastq".into(),
        out_fastq.to_string_lossy().into_owned(),
        "--proc".into(),
        args["proc"].as_u64().unwrap().to_string(),
        "--output".into(),
        output.to_string_lossy().into_owned(),
    ]);

    assert_stdout_empty(name, &result);
    assert!(
        result.status.success(),
        "{name}: exited {:?}\nstderr: {}",
        result.status.code(),
        String::from_utf8_lossy(&result.stderr)
    );

    let actual: Value =
        serde_json::from_str(&std::fs::read_to_string(&output).expect("results file"))
            .expect("results file is not valid JSON");

    assert_eq!(
        vector["result"]["subtracted"].as_u64(),
        actual["subtracted"].as_u64(),
        "{name}: subtracted count differs"
    );

    assert_eq!(
        vector["output_fastq_sha256"].as_str().unwrap(),
        sha256(&out_fastq),
        "{name}: filtered FASTQ differs from the recorded one"
    );

    assert_eq!(
        vector["output_alignments_sha256"].as_str().unwrap(),
        sha256(&out_alignments),
        "{name}: filtered alignments differ from the recorded ones"
    );
}

fn have_bowtie2() -> bool {
    ["bowtie2", "bowtie2-build"].iter().all(|program| {
        Command::new(program)
            .arg("--version")
            .output()
            .map(|out| out.status.success())
            .unwrap_or(false)
    })
}

fn check_candidates(name: &str, vector: &Value, out_dir: &Path) {
    let args = &vector["args"];
    let index = out_dir.join(format!("{name}_index"));

    let built = Command::new("bowtie2-build")
        .arg(fixtures().join(args["reference"].as_str().unwrap()))
        .arg(&index)
        .output()
        .expect("failed to run bowtie2-build");

    assert!(
        built.status.success(),
        "{name}: bowtie2-build failed: {}",
        String::from_utf8_lossy(&built.stderr)
    );

    let output = out_dir.join(format!("{name}.json"));

    let result = run(&[
        "candidates".into(),
        "--index".into(),
        index.to_string_lossy().into_owned(),
        "--reads".into(),
        fixtures()
            .join(args["reads"].as_str().unwrap())
            .to_string_lossy()
            .into_owned(),
        "--proc".into(),
        args["proc"].as_u64().unwrap().to_string(),
        "--p-score-cutoff".into(),
        args["p_score_cutoff"].as_f64().unwrap().to_string(),
        "--output".into(),
        output.to_string_lossy().into_owned(),
    ]);

    assert_stdout_empty(name, &result);
    assert!(
        result.status.success(),
        "{name}: exited {:?}\nstderr: {}",
        result.status.code(),
        String::from_utf8_lossy(&result.stderr)
    );

    let actual: Value =
        serde_json::from_str(&std::fs::read_to_string(&output).expect("results file"))
            .expect("results file is not valid JSON");

    assert_eq!(
        vector["result"].as_array().unwrap(),
        actual.as_array().unwrap(),
        "{name}: candidate set differs"
    );
}

#[test]
fn reproduces_every_golden_vector() {
    let corpus = corpus();
    let vectors = corpus["vectors"].as_array().expect("vectors array");

    assert!(!vectors.is_empty(), "the golden corpus is empty");

    let temp = tempfile::TempDir::new().expect("temp dir");
    let bowtie2 = have_bowtie2();

    // A skipped subcommand must be visible, not silently counted as a pass.
    // CI sets VT_REQUIRE_BOWTIE2 so the skip becomes a failure there.
    if !bowtie2 {
        let required = std::env::var("VT_REQUIRE_BOWTIE2").is_ok();

        assert!(
            !required,
            "VT_REQUIRE_BOWTIE2 is set but bowtie2 is not on PATH"
        );

        eprintln!(
            "WARNING: bowtie2 is not on PATH — the `candidates` vectors were NOT verified"
        );
    }

    let mut checked: BTreeMap<&str, usize> = BTreeMap::new();

    for vector in vectors {
        let name = vector["name"].as_str().expect("vector name");
        let subcommand = vector["subcommand"].as_str().expect("vector subcommand");

        match subcommand {
            "em" => check_em(name, vector, temp.path()),
            "eliminate-subtraction" => {
                check_eliminate_subtraction(name, vector, temp.path())
            }
            "candidates" => {
                if !bowtie2 {
                    continue;
                }

                check_candidates(name, vector, temp.path());
            }
            other => panic!("{name}: unknown subcommand {other}"),
        }

        *checked.entry(subcommand).or_default() += 1;
    }

    eprintln!("verified golden vectors: {checked:?}");

    assert!(
        checked.get("em").copied().unwrap_or(0) > 0
            && checked.get("eliminate-subtraction").copied().unwrap_or(0) > 0,
        "the corpus must cover em and eliminate-subtraction"
    );
}
