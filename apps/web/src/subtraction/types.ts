import type { SubtractionNested } from "@virtool/contracts";

/**
 * A subtraction as an option for analysis.
 *
 * The embedded shape plus the one thing only the client knows: whether the
 * sample the analysis is being created for already names it as a default.
 */
export type SubtractionOption = SubtractionNested & {
	isDefault?: boolean;
};
