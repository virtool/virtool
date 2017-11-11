/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import { FIND_HMMS, GET_HMM, INSTALL_HMMS } from "../actionTypes";

export const findHMMs = (url) => {
    return {
        type: FIND_HMMS.REQUESTED,
        url
    };
};

export const getHmm = (hmmId) => {
    return {
        type: GET_HMM.REQUESTED,
        hmmId: hmmId
    };
};

export const installHMMs = () => {
    return {
        type: INSTALL_HMMS.REQUESTED
    }
};
