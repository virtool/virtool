/**
 * General utility constants and functions.
 */
import { formatIsolateName as formatCanonicalIsolateName } from "@virtool/contracts";
import { get, sampleSize, startCase } from "es-toolkit/compat";

export { formatRoundedDuration } from "./date";

/**
 * A string containing all alphanumeric digits in both cases.
 */
const alphanumeric =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Create a random string with the given length.
 *
 * @param length the length of string to return
 */
export function createRandomString(length = 8) {
	return sampleSize(alphanumeric, length).join("");
}

/**
 * Download a file with the given ``filename`` with the given ``text`` content. This allows downloads of
 * dynamically generated uploads.
 */
export function followDynamicDownload(filename: string, text: string) {
	const a = document.createElement("a");
	a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
	a.download = filename;

	a.style.display = "none";
	document.body.appendChild(a);

	a.click();

	document.body.removeChild(a);
}

/**
 * An isolate's name as the OTU pages show it.
 *
 * This is the canonical name from `@virtool/contracts` with one deviation: a
 * source type of `"unknown"` — the value the add-isolate form submits when none
 * is given — renders as `"Unnamed"` rather than being named literally. Callers
 * that must agree with Python, such as the analysis exports, use the canonical
 * helper directly.
 *
 * Accepts either spelling of the two fields, because a form's values reach this
 * in camelCase while a stored isolate carries snake_case.
 */
export function formatIsolateName(isolate: object): string {
	const sourceType = get(isolate, "source_type") || get(isolate, "sourceType");

	if (sourceType === "unknown") {
		return "Unnamed";
	}

	return formatCanonicalIsolateName({
		source_name: get(isolate, "source_name") || get(isolate, "sourceName"),
		source_type: sourceType,
	});
}

/**
 * Object that maps workflow IDs to human-readable names.
 */
export const workflowDisplayNames = {
	create_sample: "Create Sample",
	create_subtraction: "Create Subtraction",
	nuvs: "Nuvs",
	pathoscope: "Pathoscope",
	build_index: "Build Index",
};

/**
 * Transforms a plain workflow ID (eg. pathoscope) to a human-readable name (eg. Pathoscope).
 *
 * @func
 * @param workflow plain workflow ID
 * @returns human-readable workflow name
 */
export function getWorkflowDisplayName(workflow: string): string {
	return get(workflowDisplayNames, workflow, startCase(workflow));
}

/**
 *  Clears session storage and reloads the page.
 *
 *  This is used to clear the session storage when the user logs out or the token expires.
 */
export function resetClient() {
	window.sessionStorage.clear();
	window.location.reload();
}
