//! The `quality-core` command line interface.
//!
//! One invocation reads **one** FASTQ file and writes one `Quality` JSON
//! object. Pairing two mates into the composite a sample stores stays in
//! TypeScript, where `compositeQuality` is tested against Python.
//!
//! The result goes to the file named by `--output`, never to stdout: the
//! workflow runtime opens a subprocess's stdout on `/dev/null` unless a
//! handler is passed, so anything written there is discarded. stderr carries
//! diagnostics, and the runtime logs it line by line.

use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::Parser;
use quality_core::{profile_fastq, QualityError};

#[derive(Parser)]
#[command(name = "quality-core", version, about, long_about = None)]
struct Cli {
    /// Path to the FASTQ file to profile. Gzipped or plain.
    #[arg(long)]
    input: PathBuf,

    /// Path to write the quality JSON to.
    #[arg(long)]
    output: PathBuf,
}

fn run(cli: Cli) -> Result<(), QualityError> {
    let quality = profile_fastq(&cli.input)?;

    let file = File::create(&cli.output)?;
    let mut writer = BufWriter::new(file);

    serde_json::to_writer(&mut writer, &quality)
        .map_err(|err| std::io::Error::other(err.to_string()))?;

    writer.write_all(b"\n")?;
    writer.flush()?;

    Ok(())
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("quality-core: {err}");
            ExitCode::FAILURE
        }
    }
}
