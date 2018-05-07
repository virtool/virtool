import { simpleActionCreator } from "../utils";
import { FIND_INDEXES, GET_INDEX, GET_UNBUILT, CREATE_INDEX, GET_INDEX_HISTORY } from "../actionTypes";

/**
 * Returns action that can trigger an API call for getting available OTU indexes.
 *
 * @func
 * @returns {object}
 */
export const findIndexes = simpleActionCreator(FIND_INDEXES.REQUESTED);

/**
 * Returns action that can trigger an API call for getting specific OTU index.
 *
 * @func
 * @param indexVersion {string} the version number of the index.
 * @returns {object}
 */
export const getIndex = (indexVersion) => ({
    type: GET_INDEX.REQUESTED,
    indexVersion
});

/**
 * Returns action that can trigger an API call for getting unbuilt data.
 *
 * @func
 * @returns {object}
 */
export const getUnbuilt = simpleActionCreator(GET_UNBUILT.REQUESTED);

/**
 * Returns action that can trigger an API call for creating a new OTU index.
 *
 * @func
 * @returns {object}
 */
export const createIndex = simpleActionCreator(CREATE_INDEX.REQUESTED);

/**
 * Returns action that can trigger an API call for getting a specific page in the index version history.
 *
 * @func
 * @param indexVersion {string} the version number of the index.
 * @param page {number} the page to retrieve from the list of changes.
 * @returns {object}
 */
export const getIndexHistory = (indexVersion, page) => ({
    type: GET_INDEX_HISTORY.REQUESTED,
    indexVersion,
    page
});
