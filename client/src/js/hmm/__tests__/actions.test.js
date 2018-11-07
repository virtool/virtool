import { FIND_HMMS, GET_HMM, INSTALL_HMMS, PURGE_HMMS } from "../../app/actionTypes";
import { getHmm, findHmms, installHMMs, purgeHMMs } from "../actions";

describe("HMM Action Creators:", () => {
    it("findHmms: returns action for filtering results by search term", () => {
        const term = "search";
        const page = 5;
        const background = true;
        const result = findHmms(term, page, background);
        expect(result).toEqual({
            type: FIND_HMMS.REQUESTED,
            term,
            page,
            background
        });
    });

    it("getHmm: returns action for getting specific hmm document", () => {
        const hmmId = "tester";
        const result = getHmm(hmmId);
        expect(result).toEqual({
            type: GET_HMM.REQUESTED,
            hmmId
        });
    });

    it("installHMMs: returns action for installing HMMs", () => {
        const releaseId = "123abc";
        const result = installHMMs(releaseId);
        expect(result).toEqual({
            type: INSTALL_HMMS.REQUESTED,
            release_id: releaseId
        });
    });

    it("purgeHMMs: returns simple action to delete HMM data", () => {
        const result = purgeHMMs();
        expect(result).toEqual({ type: PURGE_HMMS.REQUESTED });
    });
});
