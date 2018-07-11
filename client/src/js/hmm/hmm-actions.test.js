import { fetchHmms, getHmm, installHMMs } from "./actions";
import { GET_HMM, INSTALL_HMMS, FETCH_HMMS } from "../actionTypes";

describe("HMM Action Creators:", () => {

    it("fetchHmms: returns simple action", () => {
        const result = fetchHmms();
        const expected = {
            type: FETCH_HMMS
        };

        expect(result).toEqual(expected);
    });

    it("getHmm: returns action for getting specific hmm document", () => {
        const hmmId = "tester"
        const result = getHmm(hmmId);
        const expected = {
            type: GET_HMM.REQUESTED,
            hmmId
        };

        expect(result).toEqual(expected);
    });

    it("installHMMs: returns action for installing HMMs", () => {
        const result = installHMMs();
        const expected = {
            type: INSTALL_HMMS.REQUESTED
        };

        expect(result).toEqual(expected);
    });

});
