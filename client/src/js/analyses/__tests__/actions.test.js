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
    TOGGLE_SORT_PATHOSCOPE_DESCENDING,
    TOGGLE_SHOW_PATHOSCOPE_READS,
    SET_ANALYSIS_SORT_KEY,
    TOGGLE_FILTER_ORFS,
    TOGGLE_FILTER_SEQUENCES,
    TOGGLE_RESULT_EXPANDED
} from "../../app/actionTypes";
import {
    wsInsertAnalysis,
    wsUpdateAnalysis,
    wsRemoveAnalysis,
    collapseAnalysis,
    setPathoscopeFilter,
    setAnalysisSortKey,
    togglePathoscopeSortDescending,
    toggleShowPathoscopeReads,
    findAnalyses,
    getAnalysis,
    clearAnalysis,
    analyze,
    blastNuvs,
    removeAnalysis,
    toggleFilterORFs,
    toggleFilterSequences,
    toggleResultExpanded
} from "../actions";

it("wsInsertAnalysis should return action to insert analysis via websocket", () => {
    const data = { id: "foo" };
    expect(wsInsertAnalysis(data)).toEqual({
        type: WS_INSERT_ANALYSIS,
        data
    });
});

it("wsUpdateAnalysis() should return action to update analysis via websocket", () => {
    const data = { id: "baz", foo: "bar" };
    const result = wsUpdateAnalysis(data);
    expect(result).toEqual({
        type: WS_UPDATE_ANALYSIS,
        data
    });
});

it("wsRemoveAnalysis() should return action to remove analysis via websocket", () => {
    const data = ["foo"];
    const result = wsRemoveAnalysis(data);
    expect(result).toEqual({
        type: WS_REMOVE_ANALYSIS,
        data
    });
});

it("collapseAnalysis() should return action to close all expanded analyses", () => {
    const result = collapseAnalysis();
    expect(result).toEqual({ type: COLLAPSE_ANALYSIS });
});

it("setAnalysisSortKey() should return action to set sort key", () => {
    const sortKey = "foo";
    expect(setAnalysisSortKey(sortKey)).toEqual({
        type: SET_ANALYSIS_SORT_KEY,
        sortKey
    });
});

it("setPathoscopeFilter() should return action to set pathoscope filter", () => {
    const key = "filter-option";
    const result = setPathoscopeFilter(key);
    expect(result).toEqual({
        type: SET_PATHOSCOPE_FILTER,
        key
    });
});

it("toggleFilterORFs() should return action to filter ORFs", () => {
    expect(toggleFilterORFs()).toEqual({ type: TOGGLE_FILTER_ORFS });
});

it("toggleFilterSequences() should return action to filter ORFs", () => {
    expect(toggleFilterSequences()).toEqual({ type: TOGGLE_FILTER_SEQUENCES });
});

it("togglePathoscopeSortDescending() should return action to sort listings", () => {
    expect(togglePathoscopeSortDescending()).toEqual({ type: TOGGLE_SORT_PATHOSCOPE_DESCENDING });
});

it("toggleShowPathoscopeReads() should return action to display reads", () => {
    expect(toggleShowPathoscopeReads()).toEqual({ type: TOGGLE_SHOW_PATHOSCOPE_READS });
});

it("toggleResultExpanded() should return action to expand result by id", () => {
    const id = "foo";
    expect(toggleResultExpanded(id)).toEqual({ type: TOGGLE_RESULT_EXPANDED, id });
});

it("findAnalyses() should return action to find analyses", () => {
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

it("get() should return action to get a specific analysis", () => {
    const analysisId = "foo";
    const result = getAnalysis(analysisId);
    expect(result).toEqual({
        type: GET_ANALYSIS.REQUESTED,
        analysisId
    });
});

it("clearAnalysis() should return action to clear stored analysis data", () => {
    expect(clearAnalysis()).toEqual({ type: CLEAR_ANALYSIS });
});

it("analyze() should return action to analyze sample", () => {
    const originalDate = global.Date;
    const testDate = new Date("2018");
    global.Date = jest.fn(() => testDate);

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

    global.Date = originalDate;
});

it("blastNuvs() should return action to start BLAST analysis", () => {
    const analysisId = "foo";
    const sequenceIndex = 2;
    const result = blastNuvs(analysisId, sequenceIndex);
    expect(result).toEqual({
        type: BLAST_NUVS.REQUESTED,
        analysisId,
        sequenceIndex
    });
});

it("removeAnalysis() should return action to remove analysis", () => {
    const analysisId = "foo";
    const result = removeAnalysis(analysisId);
    expect(result).toEqual({
        type: REMOVE_ANALYSIS.REQUESTED,
        analysisId
    });
});
