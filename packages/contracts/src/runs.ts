import type { GroupMinimal } from "./groups";
import type { LibraryType } from "./samples";
import type { SearchResult } from "./search";
import type { UserNested } from "./users";

/**
 * How a run came to exist: `declared` from a sample sheet before its files
 * arrive, or `detected` from the FASTQ header of an uploaded file.
 */
export const RUN_ORIGINS = ["declared", "detected"] as const;

/** How a run came to exist. */
export type RunOrigin = (typeof RUN_ORIGINS)[number];

/** An instrument reduced to the fields embedded in other resources. */
export type InstrumentNested = {
	/** The unique identifier */
	id: number;

	/** The display name */
	name: string;

	/** The serial number the instrument writes into its FASTQ headers */
	serial: string;
};

/** A sequencing instrument and the groups that own it. */
export type Instrument = InstrumentNested & {
	/** When the instrument was first recorded */
	createdAt: Date;

	/**
	 * The groups whose members may create samples from its uploads. Empty means
	 * anyone may.
	 */
	groups: GroupMinimal[];

	/** The instrument model, such as MiSeq */
	model: string | null;
};

/** One sample sheet entry of a declared run. */
export type RunEntry = {
	/** The unique identifier */
	id: number;

	/** When an upload claimed the entry to create its sample */
	claimedAt: Date | null;

	/** Why the entry's sample could not be created */
	error: string | null;

	/** The i7 index sequence */
	index: string | null;

	/** The i5 index sequence */
	index2: string | null;

	/** The sample created from the entry */
	sample: { id: number; name: string } | null;

	/** The sheet's `Sample_Name` */
	sampleName: string | null;

	/** The sheet's `Sample_Project` */
	sampleProject: string | null;

	/** The sheet's `Sample_ID`, which matches the entry to its files */
	sheetSampleId: string;
};

/** A run reduced to the fields shown in lists. */
export type RunMinimal = {
	/** The unique identifier */
	id: number;

	/** When the run was recorded */
	createdAt: Date;

	/** The flowcell id, unknown until a file from the run arrives */
	flowcell: string | null;

	/** The instrument, unknown until a file from the run arrives */
	instrument: InstrumentNested | null;

	/** The display name */
	name: string;

	/** How the run came to exist */
	origin: RunOrigin;

	/** The instrument's run counter, unknown until a file from the run arrives */
	runNumber: number | null;

	/** The user who operated the run, for attribution only */
	technician: UserNested | null;

	/** The user who declared the run or uploaded its first file */
	user: UserNested;
};

/** A run with its sample defaults and sample sheet entries. */
export type Run = RunMinimal & {
	/** Whether samples are created as the run's files arrive */
	autoCreate: boolean;

	/** The sample sheet entries, empty for a detected run */
	entries: RunEntry[];

	/** The group given to samples the run creates */
	group: GroupMinimal | null;

	/** The library type given to samples the run creates */
	libraryType: LibraryType;

	/** When the run was last changed */
	updatedAt: Date;
};

/** A page of runs. */
export type RunSearchResult = SearchResult & {
	/** The runs on this page */
	items: RunMinimal[];
};
