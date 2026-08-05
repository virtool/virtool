import { WorkflowError } from "./errors";

/** How many differing paths an error message names before it gives up. */
const MAX_REPORTED_DIFFERENCES = 10;

/**
 * Describe a value well enough to identify it in an error message.
 *
 * Constructor names matter more than contents here: the whole point of the
 * report is to say *why* a value did not survive the round trip, and "Date" or
 * "function" answers that where the value itself would not.
 */
function describe(value: unknown): string {
	if (value === null) {
		return "null";
	}

	if (typeof value === "function") {
		return "function";
	}

	if (typeof value === "object") {
		const name = Object.getPrototypeOf(value)?.constructor?.name;
		return name && name !== "Object" ? name : "object";
	}

	if (typeof value === "string") {
		return JSON.stringify(value);
	}

	return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
}

/**
 * Walk two values in parallel and record every path at which they diverge.
 *
 * A plain deep-equality check would report only that the round trip changed
 * something. A `buildContext` return value is a nested domain object, and
 * hunting for the one `Date` in it is exactly the work this saves.
 */
function collectDifferences(
	original: unknown,
	roundTripped: unknown,
	path: string,
	differences: string[],
): void {
	if (differences.length >= MAX_REPORTED_DIFFERENCES) {
		return;
	}

	if (Array.isArray(original) && Array.isArray(roundTripped)) {
		if (original.length !== roundTripped.length) {
			differences.push(
				`${path}: array length changed from ${original.length} to ${roundTripped.length}`,
			);
			return;
		}

		original.forEach((element, index) => {
			collectDifferences(
				element,
				roundTripped[index],
				`${path}[${index}]`,
				differences,
			);
		});

		return;
	}

	if (isPlainObject(original) && isPlainObject(roundTripped)) {
		for (const key of new Set([
			...Object.keys(original),
			...Object.keys(roundTripped),
		])) {
			const childPath = path === "" ? key : `${path}.${key}`;

			if (!(key in roundTripped)) {
				differences.push(
					`${childPath}: ${describe(original[key])} did not survive the round trip`,
				);
				continue;
			}

			collectDifferences(
				original[key],
				roundTripped[key],
				childPath,
				differences,
			);
		}

		return;
	}

	if (!Object.is(original, roundTripped)) {
		differences.push(
			`${path}: ${describe(original)} became ${describe(roundTripped)}`,
		);
	}
}

/**
 * Assert that a `buildContext` return value survives a JSON round trip.
 *
 * The data half of a run's context is constrained to plain, serializable data
 * because the end-to-end test bed expresses a whole run as a directory of files
 * plus a JSON blob and hands it straight in. A class instance, a `Date`, or a
 * closure in there is invisible until that bed exists, so this runs on every
 * real run and not only under test — it is one round trip over a small object.
 *
 * @throws {WorkflowError} when the value cannot be JSON-encoded, or comes back
 *   from the round trip changed.
 */
export function assertSerializableData(data: unknown): void {
	let roundTripped: unknown;

	try {
		roundTripped = JSON.parse(JSON.stringify(data));
	} catch (error) {
		throw new WorkflowError(
			"workflow context data is not serializable: it could not be JSON-encoded",
			{ cause: error },
		);
	}

	const differences: string[] = [];

	collectDifferences(data, roundTripped, "", differences);

	if (differences.length > 0) {
		throw new WorkflowError(
			`workflow context data is not serializable: ${differences.join("; ")}`,
		);
	}
}
