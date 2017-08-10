/**
 * Redux actions and action creators for working with virus data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    WS_UPDATE_INDEX,
    FIND_INDEXES,
    GET_INDEX,
    CREATE_INDEX,
    GET_INDEX_HISTORY,
    CLEAR_INDEX_ERROR
} from "../actionTypes";


export function wsUpdateIndex (update) {
    return {
        type: WS_UPDATE_INDEX,
        update
    };
}

export function findIndexes () {
    return {
        type: FIND_INDEXES.REQUESTED
    };
}

export function getIndex (indexVersion) {
    return {
        type: GET_INDEX.REQUESTED,
        indexVersion
    };
}

export function createIndex () {
    return {
        type: CREATE_INDEX.REQUESTED
    };
}

export function getIndexHistory (indexVersion) {
    return {
        type: GET_INDEX_HISTORY.REQUESTED,
        indexVersion
    }
}

export function clearIndexError () {
    return {
        type: CLEAR_INDEX_ERROR
    };
}
