//! The `pathoscope-core` command line interface.
//!
//! Three subcommands, one per entry point the Python extension module used to
//! expose. The TypeScript workflow invokes this binary as a subprocess.
//!
//! Results are written to the file named by `--output`, never to stdout, so a
//! stray `println!` cannot corrupt a result. stdout carries nothing at all;
//! diagnostics go to stderr as JSON lines.

use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Args, Parser, Subcommand, ValueEnum};
use log::LevelFilter;
use pathoscope_core::{
    find_candidate_otus_with_bowtie2, run_eliminate_subtraction,
    run_expectation_maximization, PathoscopeError,
};
use serde::Serialize;

#[derive(Parser)]
#[command(name = "pathoscope-core", version, about, long_about = None)]
struct Cli {
    /// Log level. Overridden by RUST_LOG when that is set.
    #[arg(long, value_enum, default_value_t = LogLevel::Info, global = true)]
    log_level: LogLevel,

    #[command(subcommand)]
    command: Command,
}

#[derive(Copy, Clone, PartialEq, Eq, ValueEnum)]
enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

impl From<LogLevel> for LevelFilter {
    fn from(level: LogLevel) -> Self {
        match level {
            LogLevel::Error => LevelFilter::Error,
            LogLevel::Warn => LevelFilter::Warn,
            LogLevel::Info => LevelFilter::Info,
            LogLevel::Debug => LevelFilter::Debug,
            LogLevel::Trace => LevelFilter::Trace,
        }
    }
}

#[derive(Subcommand)]
enum Command {
    /// Run expectation maximization over an alignment file.
    Em(EmArgs),
    /// Find candidate OTUs by streaming bowtie2 output.
    Candidates(CandidatesArgs),
    /// Eliminate subtraction reads from an alignment and its FASTQ.
    EliminateSubtraction(EliminateSubtractionArgs),
}

#[derive(Args)]
struct EmArgs {
    /// Path to the alignment file (SAM or BAM).
    #[arg(long)]
    alignment: PathBuf,

    /// Minimum score threshold for alignments.
    #[arg(long)]
    p_score_cutoff: f64,

    /// Path to write the JSON results to.
    #[arg(long)]
    output: PathBuf,
}

#[derive(Args)]
struct CandidatesArgs {
    /// Path to the bowtie2 index.
    #[arg(long)]
    index: PathBuf,

    /// Path to a read file. Repeat once per read file.
    #[arg(long, required = true)]
    reads: Vec<PathBuf>,

    /// Number of bowtie2 threads. Must be at least 1.
    #[arg(long, value_parser = clap::value_parser!(u32).range(1..))]
    proc: u32,

    /// Minimum score threshold (AS:i score + read length).
    #[arg(long)]
    p_score_cutoff: f64,

    /// Path to write the JSON results to.
    #[arg(long)]
    output: PathBuf,
}

#[derive(Args)]
struct EliminateSubtractionArgs {
    /// Path to the isolate alignment file (SAM or BAM).
    #[arg(long)]
    isolate_alignments: PathBuf,

    /// Path to the subtraction alignment file (SAM or BAM).
    #[arg(long)]
    subtraction_alignments: PathBuf,

    /// Path to write the filtered alignment file to.
    #[arg(long)]
    output_alignments: PathBuf,

    /// Path to the input FASTQ file to filter.
    #[arg(long)]
    input_fastq: PathBuf,

    /// Path to write the filtered FASTQ file to.
    #[arg(long)]
    output_fastq: PathBuf,

    /// Number of processing threads. Must be at least 1.
    #[arg(long, value_parser = clap::value_parser!(u32).range(1..))]
    proc: u32,

    /// Path to write the JSON results to.
    #[arg(long)]
    output: PathBuf,
}

/// The `eliminate-subtraction` results file.
#[derive(Serialize)]
struct SubtractionSummary {
    subtracted: usize,
}

/// Emit structured logs to stderr as JSON lines.
///
/// This replaces the old `logging.rs`, which forwarded records to Python's
/// logging module over the GIL. There is no interpreter on the other side any
/// more — the parent is a Node process whose logger (`@virtool/logger`, a pino
/// wrapper) reads JSON.
fn init_logging(level: LevelFilter) {
    let mut builder = env_logger::Builder::new();

    builder
        .filter_level(level)
        .target(env_logger::Target::Stderr)
        .format(|buf, record| {
            writeln!(
                buf,
                "{}",
                serde_json::json!({
                    "level": record.level().as_str().to_lowercase(),
                    "target": record.target(),
                    "msg": record.args().to_string(),
                })
            )
        });

    // RUST_LOG wins over --log-level when it is set, matching the convention
    // every other Rust binary in a container follows.
    if let Ok(filter) = std::env::var("RUST_LOG") {
        builder.parse_filters(&filter);
    }

    builder.init();
}

fn write_json<T: Serialize>(path: &PathBuf, value: &T) -> Result<(), PathoscopeError> {
    let file = File::create(path)?;
    let mut writer = BufWriter::new(file);

    serde_json::to_writer(&mut writer, value)
        .map_err(|err| PathoscopeError::Parse(err.to_string()))?;

    writer.write_all(b"\n")?;
    writer.flush()?;

    Ok(())
}

fn to_strings(paths: &[PathBuf]) -> Vec<String> {
    paths
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

fn run(command: Command) -> Result<(), PathoscopeError> {
    match command {
        Command::Em(args) => {
            let results = run_expectation_maximization(
                &args.alignment.to_string_lossy(),
                args.p_score_cutoff,
            )?;

            write_json(&args.output, &results)
        }
        Command::Candidates(args) => {
            let found = find_candidate_otus_with_bowtie2(
                &args.index.to_string_lossy(),
                to_strings(&args.reads),
                args.proc,
                args.p_score_cutoff,
            )?;

            // Sorted so the results file is stable across runs; the underlying
            // set has no meaningful order.
            let mut candidates: Vec<String> = found.into_iter().collect();
            candidates.sort();

            write_json(&args.output, &candidates)
        }
        Command::EliminateSubtraction(args) => {
            let subtracted = run_eliminate_subtraction(
                &args.isolate_alignments.to_string_lossy(),
                &args.subtraction_alignments.to_string_lossy(),
                &args.output_alignments.to_string_lossy(),
                &args.input_fastq.to_string_lossy(),
                &args.output_fastq.to_string_lossy(),
                args.proc,
            )?;

            write_json(&args.output, &SubtractionSummary { subtracted })
        }
    }
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    init_logging(cli.log_level.into());

    match run(cli.command) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            log::error!("{}", err);
            ExitCode::FAILURE
        }
    }
}
