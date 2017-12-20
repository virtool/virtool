import { simpleActionCreator } from "../utils";
import { FIND_HMMS, GET_HMM, INSTALL_HMMS } from "../actionTypes";

export const findHMMs = simpleActionCreator(FIND_HMMS.REQUESTED);

export const getHmm = (hmmId) => ({
    type: GET_HMM.REQUESTED,
    hmmId
});

export const installHMMs = simpleActionCreator(INSTALL_HMMS.REQUESTED);
