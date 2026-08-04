/**
 * The colour a label falls back to when none is chosen — Tailwind `gray-300`.
 *
 * Shared by the client-side label form (its initial value) and the server-side
 * `normalizeColor` fallback (for rows with a null colour) so the two cannot
 * drift apart.
 */
export const DEFAULT_LABEL_COLOR = "#D1D5DB";

/** A label reduced to the fields embedded in other resources. */
export type LabelNested = {
	/** The hex encoded color */
	color: string;

	/** The detailed description */
	description: string;

	/** The unique identifier */
	id: number;

	/** The display name */
	name: string;
};
