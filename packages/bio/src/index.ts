/**
 * Sequence utilities and the pure text parsers that workflows need.
 *
 * Nothing here touches the filesystem, the network, or the database. A caller
 * reads the bytes and passes text. Walking a results directory, or joining an
 * HMM hit to its annotation, belongs to the workflow that does the IO.
 *
 * **Match the stored and golden output exactly, including its quirks.**
 * Virtool runs in certified lab settings. Analysis documents already written
 * sit in the same table as new ones and the same UI renders both, so a parser
 * that returns equivalent but differently rounded output is a failure.
 * `roundHalfEven` exists because `Math.round` does not round half to even,
 * `parseHmmerTblout` swaps two columns, and `findOrfs` can emit a negative
 * coordinate. Do not fix a quirk in this package alone: the fix needs a
 * coordinated change to the stored documents and the UI. Each deliberate
 * divergence is commented where it happens and pinned by a test.
 *
 * Tests write their expected numbers out, so a diff shows the value that
 * changed. A failing golden comparison is a finding. Never edit a golden
 * fixture to make it pass.
 */

export {
	type FastqRecord,
	findOrfs,
	type Orf,
	parseFasta,
	parseFastaLines,
	parseFastq,
	reverseComplement,
	translate,
} from "./bio";
export { compositeQuality, roundHalfEven } from "./fastqc";
export { type HmmerHit, parseHmmerTblout } from "./hmmer";
export {
	type IlluminaFilename,
	type IlluminaHeader,
	inferInstrumentModel,
	parseIlluminaFilename,
	parseIlluminaHeader,
	parseSampleSheet,
	type ReadSide,
	type SampleSheet,
	type SampleSheetEntry,
} from "./illumina";
