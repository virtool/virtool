/**
 * General utility constants and functions.
 *
 */
import { capitalize, get, replace, sampleSize, split, startCase, upperFirst } from "lodash-es";
import numbro from "numbro";
import { getAccountAdministrator } from "../account/selectors";

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
export const byteSize = bytes => {
    if (bytes) {
        return numbro(bytes).format({ output: "byte", base: "decimal", mantissa: 1 });
    }

    return "0.0B";
};

/**
 * Create a URL object given a find term or a page number. Both parameters are optional.
 *
 * @func
 * @param term {string} a search string to place in the URL
 * @returns {URL}
 */
export const createFindURL = term => {
    const url = new window.URL(window.location);

    if (term !== undefined) {
        if (term) {
            url.searchParams.set("find", term);
        } else {
            url.searchParams.delete("find");
        }
    }

    return url;
};

/**
 * Create a random string of {@link length} from [alphanumeric]{@link module:utils.alphanumeric}.
 *
 * @func
 * @param length {number} the length of string to return
 */
export const createRandomString = (length = 8) => sampleSize(alphanumeric, length).join("");

/**
 * Download the file at the given {@link path}.
 *
 * @func
 * @param path {string}
 */
export const followDownload = path => {
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
export const formatIsolateName = isolate => {
    const sourceType = get(isolate, "source_type") || get(isolate, "sourceType");
    const sourceName = get(isolate, "source_name") || get(isolate, "sourceName");

    return sourceType === "unknown" ? "Unnamed" : `${capitalize(sourceType)} ${sourceName}`;
};

/**
 * Transforms a plain taskName (eg. pathoscope_bowtie) to a human-readable name (eg. PathoscopeBowtie).
 *
 * @func
 * @param taskName {string} plain task name
 * @returns {string}
 */
export const getTaskDisplayName = taskName => get(taskDisplayNames, taskName, startCase(taskName));

export const reportAPIError = action => window.Raven.captureException(action.error);

export const routerLocationHasState = (state, key, value) =>
    !!state.router.location.state &&
    (value ? state.router.location.state[key] === value : !!state.router.location.state[key]);

/**
 * Returns an action creator that returns an action with ``type`` as the only property.
 *
 * @func
 * @param type {string} the value to use for the type property
 * @returns {function}
 */
export const simpleActionCreator = type =>
    function actionCreator() {
        return { type };
    };

export const getTargetChange = target => ({
    name: target.name,
    value: target.value,
    error: `error${upperFirst(target.name)}`
});

/**
 * Object that maps algorithm names (task names) to human-readable names.
 *
 * @type {object}
 */
export const taskDisplayNames = {
    aodp: "AODP",
    create_sample: "Create Sample",
    create_subtraction: "Create Subtraction",
    nuvs: "NuVs",
    pathoscope_bowtie: "Pathoscope",
    pathoscope_snap: "Pathoscope",
    build_index: "Build Index"
};

export const toThousand = number => numbro(number).format({ thousandSeparated: true });

/**
 * Converts a ``number`` to a scientific notation string.
 *
 * @func
 * @param {number} number
 * @returns {string}
 */
export const toScientificNotation = number => {
    if (number < 0.01 || number > 1000) {
        const [coefficient, exponent] = split(number.toExponential(), "e");
        return `${numbro(coefficient).format("0.00")}E${replace(exponent, "+", "")}`;
    }

    return numbro(number).format("0.000");
};

export const checkAdminOrPermission = (state, permission) =>
    getAccountAdministrator(state) || state.account.permissions[permission];
