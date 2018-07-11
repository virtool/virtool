import {
    wsUpdateAnalysis,
    wsRemoveAnalysis,
    findAnalyses,
    getAnalysis,
    getAnalysisProgress,
    analyze,
    blastNuvs,
    removeAnalysis
} from "./actions";
import {
    WS_UPDATE_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    GET_ANALYSIS_PROGRESS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS
} from "../actionTypes";

describe("Analyses Action Creators:", () => {

    it("wsUpdateAnalysis: returns action for analysis update via websocket", () => {
        const update = {};
        const result = wsUpdateAnalysis(update);
        const expected = {
            type: WS_UPDATE_ANALYSIS,
            update
        };

        expect(result).toEqual(expected);
    });

    it("wsRemoveAnalysis: returns action for analysis removal via websocket", () => {
        const removed = "";
        const result = wsRemoveAnalysis(removed);
        const expected = {
            type: WS_REMOVE_ANALYSIS,
            removed
        };

        expect(result).toEqual(expected);
    });

    it("findAnalyses: returns action to find analyses for a sample", () => {
        const sampleId = "testid";
        const result = findAnalyses(sampleId);
        const expected = {
            type: FIND_ANALYSES.REQUESTED,
            sampleId
        };

        expect(result).toEqual(expected);
    });

    it("getAnalysis: returns action to get a specific analysis", () => {
        const analysisId = "testid";
        const result = getAnalysis(analysisId);
        const expected = {
            type: GET_ANALYSIS.REQUESTED,
            analysisId
        };

        expect(result).toEqual(expected);
    });

    it("getAnalysisProgress: returns action to get current progress of analysis", () => {
        const progress = 5;
        const result = getAnalysisProgress(progress);
        const expected = {
            type: GET_ANALYSIS_PROGRESS,
            progress
        };

        expect(result).toEqual(expected);
    });

    describe("analyze:", () => {
        let originalDate;

        beforeEach(() => {
            // 2018 Jan 1st
            originalDate = global.Date;
            const testDate = new Date("2018");
            global.Date = jest.fn(() => testDate);
        });

        afterEach(() => {
            global.Date = originalDate;
        });

        it("returns action to analyze sample", () => {
            const sampleId = "testid";
            const algorithm = "algorithm";
            const refId = "123abc";
            const created_at = new Date().toISOString();
            const result = analyze(sampleId, refId, algorithm);
            const expected = {
                type: ANALYZE.REQUESTED,
                algorithm,
                placeholder: {
                    algorithm,
                    created_at,
                    ready: false,
                    placeholder: true
                },
                refId,
                sampleId
            };

            expect(result).toEqual(expected);
        });

    });

    it("blastNuvs: returns action for BLAST analysis", () => {
        const analysisId = "testid";
        const sequenceIndex = 2;
        const result = blastNuvs(analysisId, sequenceIndex);
        const expected = {
            type: BLAST_NUVS.REQUESTED,
            analysisId,
            sequenceIndex
        };

        expect(result).toEqual(expected);
    });

    it("removeAnalysis: returns action to remove analysis", () => {
        const analysisId = "testid";
        const result = removeAnalysis(analysisId);
        const expected = {
            type: REMOVE_ANALYSIS.REQUESTED,
            analysisId
        };

        expect(result).toEqual(expected);
    });

});
