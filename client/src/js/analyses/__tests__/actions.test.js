import {
    WS_INSERT_ANALYSIS,
    WS_UPDATE_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS,
    CLEAR_ANALYSIS,
    COLLAPSE_ANALYSIS,
    SET_PATHOSCOPE_FILTER,
    SET_PATHOSCOPE_SORT_KEY,
    TOGGLE_ANALYSIS_EXPANDED,
    TOGGLE_SORT_PATHOSCOPE_DESCENDING,
    TOGGLE_SHOW_PATHOSCOPE_MEDIAN,
    TOGGLE_SHOW_PATHOSCOPE_READS
} from "../../app/actionTypes";
import {
    wsInsertAnalysis,
    wsUpdateAnalysis,
    wsRemoveAnalysis,
    collapseAnalysis,
    toggleExpanded,
    setPathoscopeFilter,
    setSortKey,
    togglePathoscopeSortDescending,
    toggleShowPathoscopeMedian,
    toggleShowPathoscopeReads,
    findAnalyses,
    getAnalysis,
    clearAnalysis,
    analyze,
    blastNuvs,
    removeAnalysis
} from "../actions";

describe("Analyses Action Creators:", () => {
    it("wsInsertAnalysis: returns action to insert analysis via websocket", () => {
        const data = { id: "foo" };
        const result = wsInsertAnalysis(data);
        expect(result).toEqual({
            type: WS_INSERT_ANALYSIS,
            data
        });
    });

    it("wsUpdateAnalysis: returns action for analysis update via websocket", () => {
        const data = { id: "baz", foo: "bar" };
        const result = wsUpdateAnalysis(data);
        expect(result).toEqual({
            type: WS_UPDATE_ANALYSIS,
            data
        });
    });

    it("wsRemoveAnalysis: returns action for analysis removal via websocket", () => {
        const data = ["foo"];
        const result = wsRemoveAnalysis(data);
        expect(result).toEqual({
            type: WS_REMOVE_ANALYSIS,
            data
        });
    });

    it("collapseAnalysis: returns action to close all expanded analyses", () => {
        const result = collapseAnalysis();
        expect(result).toEqual({ type: COLLAPSE_ANALYSIS });
    });

    it("toggleExpanded: returns action to toggle analysis expansion", () => {
        const id = "test-analysis";
        const result = toggleExpanded(id);
        expect(result).toEqual({
            type: TOGGLE_ANALYSIS_EXPANDED,
            id
        });
    });

    it("setPathoscopeFilter: returns action to set pathoscope filter", () => {
        const key = "filter-option";
        const result = setPathoscopeFilter(key);
        expect(result).toEqual({
            type: SET_PATHOSCOPE_FILTER,
            key
        });
    });

    it("setSortKey: returns action to set sorting option", () => {
        const key = "sort-option";
        const result = setSortKey(key);
        expect(result).toEqual({
            type: SET_PATHOSCOPE_SORT_KEY,
            key
        });
    });

    it("togglePathoscopeSortDescending: returns action to sort listings", () => {
        expect(togglePathoscopeSortDescending()).toEqual({ type: TOGGLE_SORT_PATHOSCOPE_DESCENDING });
    });

    it("toggleShowPathoscopeMedian: returns action to display median", () => {
        expect(toggleShowPathoscopeMedian()).toEqual({ type: TOGGLE_SHOW_PATHOSCOPE_MEDIAN });
    });

    it("toggleShowPathoscopeReads: returns action to display reads", () => {
        expect(toggleShowPathoscopeReads()).toEqual({ type: TOGGLE_SHOW_PATHOSCOPE_READS });
    });

    it("findAnalyses: returns action to find analyses", () => {
        const sampleId = "foo";
        const term = "search";
        const page = 2;
        const result = findAnalyses(sampleId, term, page);
        expect(result).toEqual({
            type: FIND_ANALYSES.REQUESTED,
            sampleId,
            term,
            page
        });
    });

    it("get: returns action to get a specific analysis", () => {
        const analysisId = "foo";
        const result = getAnalysis(analysisId);
        expect(result).toEqual({
            type: GET_ANALYSIS.REQUESTED,
            analysisId
        });
    });

    it("clearAnalysis: returns action to clear stored analysis data", () => {
        expect(clearAnalysis()).toEqual({ type: CLEAR_ANALYSIS });
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
            const sampleId = "foo";
            const algorithm = "algorithm";
            const refId = "123abc";
            const userId = "bob";
            const created_at = new Date().toISOString();
            const result = analyze(sampleId, refId, algorithm, userId);

            expect(result).toEqual({
                type: ANALYZE.REQUESTED,
                algorithm,
                placeholder: {
                    algorithm,
                    created_at,
                    ready: false,
                    placeholder: true
                },
                userId,
                refId,
                sampleId
            });
        });
    });

    it("blastNuvs: returns action for BLAST analysis", () => {
        const analysisId = "foo";
        const sequenceIndex = 2;
        const result = blastNuvs(analysisId, sequenceIndex);
        expect(result).toEqual({
            type: BLAST_NUVS.REQUESTED,
            analysisId,
            sequenceIndex
        });
    });

    it("handleRemove: returns action to handleRemove analysis", () => {
        const analysisId = "foo";
        const result = removeAnalysis(analysisId);
        expect(result).toEqual({
            type: REMOVE_ANALYSIS.REQUESTED,
            analysisId
        });
    });
});
