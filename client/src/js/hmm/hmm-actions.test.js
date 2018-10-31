import { GET_HMM, INSTALL_HMMS, PURGE_HMMS } from "../actionTypes";
import { getHmm, installHMMs, purgeHMMs } from "./actions";

describe("HMM Action Creators:", () => {
    let result;
    let expected;

    it("filterHmms: returns action for filtering results by search term", () => {
        const term = "search";
        result = filterHmms(term);
        expected = {
            type: FILTER_HMMS.REQUESTED,
            term
        };
        expect(result).toEqual(expected);
    });

    it("listHmms: returns action to fetch specific page of hmm documents", () => {
        const page = 1;
        result = listHmms(page);
        expected = {
            type: LIST_HMMS.REQUESTED,
            page
        };
        expect(result).toEqual(expected);
    });

    it("getHmm: returns action for getting specific hmm document", () => {
        const hmmId = "tester";
        result = getHmm(hmmId);
        expected = {
            type: GET_HMM.REQUESTED,
            hmmId
        };
        expect(result).toEqual(expected);
    });

    it("installHMMs: returns action for installing HMMs", () => {
        const releaseId = "123abc";
        result = installHMMs(releaseId);
        expected = {
            type: INSTALL_HMMS.REQUESTED,
            release_id: releaseId
        };
        expect(result).toEqual(expected);
    });

    it("purgeHMMs: returns simple action to delete HMM data", () => {
        result = purgeHMMs();
        expected = { type: PURGE_HMMS.REQUESTED };
        expect(result).toEqual(expected);
    });
});
