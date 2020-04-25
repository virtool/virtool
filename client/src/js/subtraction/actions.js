import {
    WS_INSERT_SUBTRACTION,
    WS_UPDATE_SUBTRACTION,
    WS_REMOVE_SUBTRACTION,
    GET_SUBTRACTION,
    EDIT_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION,
    FIND_SUBTRACTIONS,
    SHORTLIST_SUBTRACTIONS
} from "../app/actionTypes";

import { simpleActionCreator } from "../utils/utils";

export const wsInsertSubtraction = data => ({
    type: WS_INSERT_SUBTRACTION,
    data
});

export const wsUpdateSubtraction = data => ({
    type: WS_UPDATE_SUBTRACTION,
    data
});

export const wsRemoveSubtraction = data => ({
    type: WS_REMOVE_SUBTRACTION,
    data
});

export const findSubtractions = (term, page) => ({
    type: FIND_SUBTRACTIONS.REQUESTED,
    term,
    page
});

export const shortlistSubtractions = simpleActionCreator(SHORTLIST_SUBTRACTIONS.REQUESTED);

/**
 * Returns action that can trigger an API call to retrieve a subtraction.
 *
 * @func
 * @param subtractionId {string} unique subtraction id
 * @returns {object}
 */
export const getSubtraction = subtractionId => ({
    type: GET_SUBTRACTION.REQUESTED,
    subtractionId
});

/**
 * Returns action that can trigger an API call to create a new subtraction.
 *
 * @func
 * @param fileId {string} the unique id of the host FASTA file
 * @param name {string} display name for the subtraction
 * @param nickname {string} common or nickname for the subtraction host
 * @returns {object}
 */
export const createSubtraction = (fileId, name, nickname) => ({
    type: CREATE_SUBTRACTION.REQUESTED,
    fileId,
    name,
    nickname
});

/**
 * Returns action that can trigger an API call to modify a subtraction.
 *
 * @func
 * @param subtractionId {string} unique subtraction id
 * @param name {string} a new name for the host
 * @param nickname {string} common or nickname for the subtraction host
 * @returns {object}
 */
export const editSubtraction = (subtractionId, name, nickname) => ({
    type: EDIT_SUBTRACTION.REQUESTED,
    subtractionId,
    name,
    nickname
});

/**
 * Returns action that can trigger an API call to remove a subtraction.
 *
 * @func
 * @param subtractionId {string} unique subtraction id
 * @returns {object}
 */
export const removeSubtraction = subtractionId => ({
    type: REMOVE_SUBTRACTION.REQUESTED,
    subtractionId
});
