import {
    wsUpdateSample,
    wsRemoveSample,
    wsUpdateAnalysis,
    wsRemoveAnalysis,
    findReadyHosts,
    getSample,
    createSample,
    editSample,
    updateSampleRights,
    removeSample,
    showRemoveSample,
    hideSampleModal,
    findAnalyses,
    getAnalysis,
    getAnalysisProgress,
    analyze,
    blastNuvs,
    removeAnalysis
} from "./actions";
import {
    WS_UPDATE_SAMPLE,
    WS_REMOVE_SAMPLE,
    WS_UPDATE_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    FIND_READY_HOSTS,
    GET_SAMPLE,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    REMOVE_SAMPLE,
    FIND_ANALYSES,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL, GET_ANALYSIS_PROGRESS
} from "../actionTypes";

describe("Sample Action Creators:", () => {
    
    it("wsUpdateSample: returns action for sample update via websocket", () => {
        const update = {};
        const result = wsUpdateSample(update);
        const expected = {
            type: "WS_UPDATE_SAMPLE",
            update
        };

        expect(result).toEqual(expected);
    });

    it("wsRemoveSample: returns action for sample removal via websocket", () => {
        const removed = "";
        const result = wsRemoveSample(removed);
        const expected = {
            type: "WS_REMOVE_SAMPLE",
            removed
        };

        expect(result).toEqual(expected);
    });

    it("wsUpdateAnalysis: returns action for analysis update via websocket", () => {
        const update = {};
        const result = wsUpdateAnalysis(update);
        const expected = {
            type: "WS_UPDATE_ANALYSIS",
            update
        };

        expect(result).toEqual(expected);
    });

    it("wsRemoveAnalysis: returns action for analysis removal via websocket", () => {
        const removed = "";
        const result = wsRemoveAnalysis(removed);
        const expected = {
            type: "WS_REMOVE_ANALYSIS",
            removed
        };

        expect(result).toEqual(expected);
    });

    it("findReadyHosts: returns simple action", () => {
        const result = findReadyHosts();
        const expected = {
            type: "FIND_READY_HOSTS_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("getSample: returns action for getting specific sample", () => {
        const sampleId = "testsample";
        const result = getSample(sampleId);
        const expected = {
            type: "GET_SAMPLE_REQUESTED",
            sampleId
        };

        expect(result).toEqual(expected);
    });

    it("createSample: returns action for creating sample", () => {
        const name = "name";
        const isolate = "isolate";
        const host = "host";
        const locale = "locale";
        const subtraction = "subtraction";
        const files = {};
        const result = createSample(name, isolate, host, locale, subtraction, files);
        const expected = {
            type: "CREATE_SAMPLE_REQUESTED",
            name,
            isolate,
            host,
            locale,
            subtraction,
            files
        };

        expect(result).toEqual(expected);
    });

    it("editSample: returns action for modifying a sample", () => {
        const sampleId = "testid";
        const update = {};
        const result = editSample(sampleId, update);
        const expected = {
            type: "UPDATE_SAMPLE_REQUESTED",
            sampleId,
            update
        };

        expect(result).toEqual(expected);
    });

    it("updateSampleRights: returns action for updating a sample's permissions", () => {
        const sampleId = "testid";
        const update = {};
        const result = updateSampleRights(sampleId, update);
        const expected = {
            type: "UPDATE_SAMPLE_RIGHTS_REQUESTED",
            sampleId,
            update
        };

        expect(result).toEqual(expected);
    });

    it("removeSample: returns action to remove a sample", () => {
        const sampleId = "testid";
        const result = removeSample(sampleId);
        const expected = {
            type: "REMOVE_SAMPLE_REQUESTED",
            sampleId
        };

        expect(result).toEqual(expected);
    });

    it("showRemoveSample: returns simple action", () => {
        const result = showRemoveSample();
        const expected = {
            type: "SHOW_REMOVE_SAMPLE"
        };

        expect(result).toEqual(expected);
    });

    it("hideSampleModal: returns simple action", () => {
        const result = hideSampleModal();
        const expected = {
            type: "HIDE_SAMPLE_MODAL"
        };

        expect(result).toEqual(expected);
    });

    it("findAnalyses: returns action to find analyses for a sample", () => {
        const sampleId = "testid";
        const result = findAnalyses(sampleId);
        const expected = {
            type: "FIND_ANALYSES_REQUESTED",
            sampleId
        };

        expect(result).toEqual(expected);
    });

    it("getAnalysis: returns action to get a specific analysis", () => {
        const analysisId = "testid";
        const result = getAnalysis(analysisId);
        const expected = {
            type: "GET_ANALYSIS_REQUESTED",
            analysisId
        };

        expect(result).toEqual(expected);
    });

    it("getAnalysisProgress: returns action to get current progress of analysis", () => {
        const progress = 5;
        const result = getAnalysisProgress(progress);
        const expected = {
            type: "GET_ANALYSIS_PROGRESS",
            progress
        };

        expect(result).toEqual(expected);
    });

    describe("analyze:", () => {
        let originalDate;

        beforeEach(() => {
            // 2018 Jan 1st
            originalDate = global.Date;
            const testDate = new Date('2018');
            global.Date = jest.fn(() => testDate);
        });

        afterEach(() => {
            global.Date = originalDate;
        });

        it("returns action to analyze sample", () => {
            const sampleId = "testid";
            const algorithm = "algorithm";
            const created_at = new Date().toISOString();
            const result = analyze(sampleId, algorithm);
            const expected = {
                type: "ANALYZE_REQUESTED",
                algorithm,
                placeholder: {
                    algorithm,
                    created_at,
                    ready: false,
                    placeholder: true
                },
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
            type: "BLAST_NUVS_REQUESTED",
            analysisId,
            sequenceIndex
        };

        expect(result).toEqual(expected);
    });

    it("removeAnalysis: returns action to remove analysis", () => {
        const analysisId = "testid";
        const result = removeAnalysis(analysisId);
        const expected = {
            type: "REMOVE_ANALYSIS_REQUESTED",
            analysisId
        };

        expect(result).toEqual(expected);
    });

});
