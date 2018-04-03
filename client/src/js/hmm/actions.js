import { simpleActionCreator } from "../utils";
import { GET_HMM, INSTALL_HMMS, FETCH_HMMS } from "../actionTypes";

/**
 * Returns action that can trigger an API call for fetching available HMMs.
 *
 * @func
 * @returns {object}
 */
export const fetchHmms = simpleActionCreator(FETCH_HMMS);

/**
 * Returns action that can trigger an API call for getting specific hmm documents from database.
 *
 * @func
 * @param hmmId {string} unique id for specific hmm document
 * @returns {object}
 */
export const getHmm = (hmmId) => ({
    type: GET_HMM.REQUESTED,
    hmmId
});

/**
 * Returns action that can trigger an API call for installing HMMs from virtool repository.
 *
 * @func
 * @returns {object}
 */
export const installHMMs = simpleActionCreator(INSTALL_HMMS.REQUESTED);
