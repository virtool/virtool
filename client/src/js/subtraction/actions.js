import {
    GET_SUBTRACTION,
    UPDATE_SUBTRACTION,
    CREATE_SUBTRACTION,
    REMOVE_SUBTRACTION
} from "../actionTypes";

/**
 * Returns action that can trigger an API call to retrieve a subtraction.
 *
 * @func
 * @param subtractionId {string} unique subtraction id
 * @returns {object}
 */
export const getSubtraction = (subtractionId) => ({
    type: GET_SUBTRACTION.REQUESTED,
    subtractionId
});

/**
 * Returns action that can trigger an API call to create a new subtraction.
 *
 * @func
 * @param subtractionId {string} unique subtraction id
 * @param fileId {string} the unique id of the host FASTA file
 * @param nickname {string} common or nickname for the subtraction host
 * @returns {object}
 */
export const createSubtraction = (subtractionId, fileId, nickname) => ({
    type: CREATE_SUBTRACTION.REQUESTED,
    subtractionId,
    fileId,
    nickname
});

/**
 * Returns action that can trigger an API call to modify a subtraction.
 *
 * @func
 * @param subtractionId {string} unique subtraction id
 * @param nickname {string} common or nickname for the subtraction host
 * @returns {object}
 */
export const updateSubtraction = (subtractionId, nickname) => ({
    type: UPDATE_SUBTRACTION.REQUESTED,
    subtractionId,
    nickname
});

/**
 * Returns action that can trigger an API call to remove a subtraction.
 *
 * @func
 * @param subtractionId {string} unique subtraction id
 * @returns {object}
 */
export const removeSubtraction = (subtractionId) => ({
    type: REMOVE_SUBTRACTION.REQUESTED,
    subtractionId
});
