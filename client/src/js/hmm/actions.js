import { simpleActionCreator } from "../utils/utils";
import { GET_HMM, INSTALL_HMMS, FIND_HMMS, PURGE_HMMS } from "../app/actionTypes";

export const findHmms = (term, page, background = true) => ({
    type: FIND_HMMS.REQUESTED,
    term,
    page,
    background
});

/**
 * Returns action that can trigger an API call for getting specific hmm documents from database.
 *
 * @func
 * @param hmmId {string} unique id for specific hmm document
 * @returns {object}
 */
export const getHmm = hmmId => ({
    type: GET_HMM.REQUESTED,
    hmmId
});

/**
 * Returns action that can trigger an API call for installing HMMs from virtool repository.
 *
 * @func
 * @returns {object}
 */
export const installHMMs = releaseId => ({
    type: INSTALL_HMMS.REQUESTED,
    release_id: releaseId
});

/**
 * Returns action that can trigger an API call for purging all HMMs. In other words, removing unreferenced HMM profiles
 * and deleting the profiles.hmm file.
 *
 * @func
 * @returns {object}
 */
export const purgeHMMs = simpleActionCreator(PURGE_HMMS.REQUESTED);
