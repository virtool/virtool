import {
    ANALYZE,
    BLAST_NUVS,
    CLEAR_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    REMOVE_ANALYSIS,
    SET_ANALYSIS_SORT_KEY,
    TOGGLE_ANALYSIS_SORT_DESCENDING,
    TOGGLE_FILTER_ORFS,
    TOGGLE_FILTER_SEQUENCES,
    TOGGLE_SHOW_PATHOSCOPE_READS,
    WS_INSERT_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    WS_UPDATE_ANALYSIS
} from "../../app/actionTypes";
import {
    analyze,
    blastNuvs,
    clearAnalysis,
    findAnalyses,
    getAnalysis,
    removeAnalysis,
    setAnalysisSortKey,
    toggleAnalysisSortDescending,
    toggleFilterORFs,
    toggleFilterSequences,
    toggleShowPathoscopeReads,
    wsInsertAnalysis,
    wsRemoveAnalysis,
    wsUpdateAnalysis
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

it("setAnalysisSortKey() should return action to set sort key", () => {
    const sortKey = "foo";
    expect(setAnalysisSortKey(sortKey)).toEqual({
        type: SET_ANALYSIS_SORT_KEY,
        sortKey
    });
});

it("toggleFilterORFs() should return action to filter ORFs", () => {
    expect(toggleFilterORFs()).toEqual({ type: TOGGLE_FILTER_ORFS });
});

it("toggleFilterSequences() should return action to filter ORFs", () => {
    expect(toggleFilterSequences()).toEqual({ type: TOGGLE_FILTER_SEQUENCES });
});

it("toggleAnalysisSortDescending() should return action to sort listings", () => {
    expect(toggleAnalysisSortDescending()).toEqual({ type: TOGGLE_ANALYSIS_SORT_DESCENDING });
});

it("toggleShowPathoscopeReads() should return action to display reads", () => {
    expect(toggleShowPathoscopeReads()).toEqual({ type: TOGGLE_SHOW_PATHOSCOPE_READS });
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
    const workflow = "workflow";
    const refId = "123abc";
    const userId = "bob";
    const subtractionIds = "bar";
    const result = analyze(sampleId, refId, subtractionIds, userId, workflow);

    expect(result).toEqual({
        type: ANALYZE.REQUESTED,
        userId,
        refId,
        sampleId,
        subtractionIds,
        workflow
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
