/**
 * General utility constants and functions.
 *
 * @module utils
 * @author igboyes
 */
import Numeral from "numeral";
import { sampleSize, get, startCase, capitalize } from "lodash";

/**
 * A string containing all alphanumeric digits in both cases.
 *
 * @type {string}
 */
export const alphanumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Converts an integer in bytes to a nicely formatted string (eg. 10.2 GB).
 *
 * @func
 * @param bytes {number}
 * @returns {string}
 */
export const byteSize = bytes => (
    Numeral(bytes).format("0.0 b")
);

/**
 * Create a URL object given a find term or a page number. Both parameters are optional.
 *
 * @func
 * @param find {string} a search string to place in the URL
 * @param page {(number|string)} a page number to place in the URL
 * @returns {URL}
 */
export const createFindURL = ({ find, page }) => {
    const url = new window.URL(window.location);

    if (find !== undefined) {
        if (find) {
            url.searchParams.set("find", find);
        } else {
            url.searchParams.delete("find");
        }
    }

    if (page) {
        url.searchParams.set("page", page);
    }

    return url;
};

/**
 * Create a random string of {@link length} from [alphanumeric]{@link module:utils.alphanumeric}.
 *
 * @func
 * @param length {number} the length of string to return
 */
export const createRandomString = (length = 8) => (
    sampleSize(alphanumeric, length).join("")
);

/**
 * Download the file at the given {@link path}.
 *
 * @func
 * @param path {string}
 */
export const followDownload = (path) => {
    const a = document.createElement("A");
    a.href = path;
    a.download = path.substr(path.lastIndexOf("/") + 1);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

/**
 * Download a file with the given ``filename`` with the given ``text`` content. This allows downloads of
 * dynamically generated files.
 *
 * @func
 * @param filename
 * @param text
 */
export const followDynamicDownload = (filename, text) => {
    const a = document.createElement("a");
    a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
    a.download = filename;

    a.style.display = "none";
    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);
};

/**
 * Return a formatted isolate name given an ``isolate`` object.
 *
 * @func
 * @param isolate {object}
 * @returns {string}
 */
export const formatIsolateName = (isolate) => {
    const sourceType = get(isolate, "source_type") || get(isolate, "sourceType");
    const sourceName = get(isolate, "source_name") || get(isolate, "sourceName");

    return sourceType === "unknown" ? "Unnamed" : `${capitalize(sourceType)} ${sourceName}`;
};

/**
 * Get the find term from the current browser URL or a passed URL object.
 *
 * @func
 * @param url {URL} an optional url to get a find term from
 * @returns {string | undefined}
 */
export const getFindTerm = (url = new window.URL(window.location)) => (
    url.searchParams.get("find") || ""
);

/**
 * Transforms a plain taskName (eg. pathoscope_bowtie) to a human-readable name (eg. PathoscopeBowtie).
 *
 * @func
 * @param taskName {string} plain task name
 * @returns {string}
 */
export const getTaskDisplayName = (taskName) => (
    get(taskDisplayNames, taskName, startCase(taskName))
);

/**
 * Returns an action creator that returns an action with ``type`` as the only property.
 *
 * @func
 * @param type {string} the value to use for the type property
 * @returns {function}
 */
export const simpleActionCreator = (type) => (
    function actionCreator () {
        return {type};
    }
);

/**
 * Object that maps algorithm names (task names) to human-readable names.
 *
 * @type {object}
 */
export const taskDisplayNames = {
    nuvs: "NuVs",
    pathoscope_bowtie: "PathoscopeBowtie",
    pathoscope_snap: "PathoscopeSNAP"
};

/**
 * Converts a ``number`` to a scientific notation string.
 *
 * @func
 * @param {number} number
 * @returns {string}
 */
export const toScientificNotation = (number) => {
    if (number < 0.01 || number > 1000) {
        const split = number.toExponential().split("e");
        const exponent = split[1].replace("+", "");
        return Numeral(split[0]).format("0.00") + "ₑ" + exponent;
    }

    return Numeral(number).format("0.000");
};
