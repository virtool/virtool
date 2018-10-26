import {
    WS_INSERT_INDEX,
    WS_UPDATE_INDEX,
    FIND_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    CREATE_INDEX,
    GET_INDEX_HISTORY,
    LIST_READY_INDEXES,
    WS_INSERT_HISTORY
} from "../actionTypes";

export const wsInsertHistory = data => ({
    type: WS_INSERT_HISTORY,
    data
});

export const wsInsertIndex = data => ({
    type: WS_INSERT_INDEX,
    data
});

/**
 * Returns an action that should be dispatched when an index document is updated via websocket.
 *
 * @func
 * @param data {object} the data passed in the websocket message
 * @returns {object}
 */
export const wsUpdateIndex = data => ({
    type: WS_UPDATE_INDEX,
    data
});

/**
 * Returns action that can trigger an API call for getting available OTU indexes.
 *
 * @func
 * @returns {object}
 */
export const findIndexes = (refId, term, page) => ({
    type: FIND_INDEXES.REQUESTED,
    refId,
    term,
    page
});

/**
 * Returns action that can trigger an API call for getting all ready OTU indexes.
 *
 * @func
 * @returns {object}
 */
export const listReadyIndexes = () => ({
    type: LIST_READY_INDEXES.REQUESTED
});

/**
 * Returns action that can trigger an API call for getting specific OTU index.
 *
 * @func
 * @param indexId {string} the unique index id.
 * @returns {object}
 */
export const getIndex = indexId => ({
    type: GET_INDEX.REQUESTED,
    indexId
});

/**
 * Returns action that can trigger an API call for getting unbuilt data.
 *
 * @func
 * @returns {object}
 */
export const getUnbuilt = refId => ({
    type: GET_UNBUILT.REQUESTED,
    refId
});

/**
 * Returns action that can trigger an API call for creating a new OTU index.
 *
 * @func
 * @returns {object}
 */
export const createIndex = refId => ({
    type: CREATE_INDEX.REQUESTED,
    refId
});

/**
 * Returns action that can trigger an API call for getting a specific page in the index version history.
 *
 * @func
 * @param indexId {string} the unique index id.
 * @param page {number} the page to retrieve from the list of changes.
 * @returns {object}
 */
export const getIndexHistory = (indexId, page) => ({
    type: GET_INDEX_HISTORY.REQUESTED,
    indexId,
    page
});
