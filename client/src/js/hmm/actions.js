import { simpleActionCreator } from "../utils";
import { GET_HMM, INSTALL_HMMS } from "../actionTypes";

export const getHmm = (hmmId) => ({
    type: GET_HMM.REQUESTED,
    hmmId
});

export const installHMMs = simpleActionCreator(INSTALL_HMMS.REQUESTED);
