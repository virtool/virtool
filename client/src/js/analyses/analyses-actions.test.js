import {
  WS_INSERT_ANALYSIS,
  WS_UPDATE_ANALYSIS,
  WS_REMOVE_ANALYSIS,
  FIND_ANALYSES,
  FILTER_ANALYSES,
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
} from "../actionTypes";
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
  filterAnalyses,
  getAnalysis,
  clearAnalysis,
  analyze,
  blastNuvs,
  removeAnalysis
} from "./actions";

describe("Analyses Action Creators:", () => {
  let data;
  let analysisId;
  let sampleId;
  let result;
  let expected;

  it("wsInsertAnalysis: returns action to insert analysis via websocket", () => {
    data = { id: "test" };
    result = wsInsertAnalysis(data);
    expected = {
      type: WS_INSERT_ANALYSIS,
      data
    };
    expect(result).toEqual(expected);
  });

  it("wsUpdateAnalysis: returns action for analysis update via websocket", () => {
    data = { id: "test", foo: "bar" };
    result = wsUpdateAnalysis(data);
    expected = {
      type: WS_UPDATE_ANALYSIS,
      data
    };
    expect(result).toEqual(expected);
  });

  it("wsRemoveAnalysis: returns action for analysis removal via websocket", () => {
    data = ["test"];
    result = wsRemoveAnalysis(data);
    expected = {
      type: WS_REMOVE_ANALYSIS,
      data
    };
    expect(result).toEqual(expected);
  });

  it("collapseAnalysis: returns action for close all expanded analyses", () => {
    result = collapseAnalysis();
    expected = { type: COLLAPSE_ANALYSIS };
    expect(result).toEqual(expected);
  });

  it("toggleExpanded: returns action to toggle analysis expansion", () => {
    const id = "test-analysis";
    result = toggleExpanded(id);
    expected = {
      type: TOGGLE_ANALYSIS_EXPANDED,
      id
    };
    expect(result).toEqual(expected);
  });

  it("setPathoscopeFilter: returns action to set pathoscope filter", () => {
    const key = "filter-option";
    result = setPathoscopeFilter(key);
    expected = {
      type: SET_PATHOSCOPE_FILTER,
      key
    };
    expect(result).toEqual(expected);
  });

  it("setSortKey: returns action to set sorting option", () => {
    const key = "sort-option";
    result = setSortKey(key);
    expected = {
      type: SET_PATHOSCOPE_SORT_KEY,
      key
    };
    expect(result).toEqual(expected);
  });

  it("togglePathoscopeSortDescending: returns action to sort listings", () => {
    result = togglePathoscopeSortDescending();
    expected = { type: TOGGLE_SORT_PATHOSCOPE_DESCENDING };
    expect(result).toEqual(expected);
  });

  it("toggleShowPathoscopeMedian: returns action to display median", () => {
    result = toggleShowPathoscopeMedian();
    expected = { type: TOGGLE_SHOW_PATHOSCOPE_MEDIAN };
    expect(result).toEqual(expected);
  });

  it("toggleShowPathoscopeReads: returns action to display reads", () => {
    result = toggleShowPathoscopeReads();
    expected = { type: TOGGLE_SHOW_PATHOSCOPE_READS };
    expect(result).toEqual(expected);
  });

  it("findAnalyses: returns action to find analyses for a sample", () => {
    sampleId = "testid";
    result = findAnalyses(sampleId);
    expected = {
      type: FIND_ANALYSES.REQUESTED,
      sampleId
    };
    expect(result).toEqual(expected);
  });

  it("filterAnalyses: returns action to filter list by search term", () => {
    sampleId = "testid";
    const term = "search";
    result = filterAnalyses(sampleId, term);
    expected = {
      type: FILTER_ANALYSES.REQUESTED,
      sampleId,
      term
    };
    expect(result).toEqual(expected);
  });

  it("getAnalysis: returns action to get a specific analysis", () => {
    analysisId = "testid";
    result = getAnalysis(analysisId);
    expected = {
      type: GET_ANALYSIS.REQUESTED,
      analysisId
    };
    expect(result).toEqual(expected);
  });

  it("clearAnalysis: returns action to clear stored analysis data", () => {
    result = clearAnalysis();
    expected = { type: CLEAR_ANALYSIS };
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
      sampleId = "testid";
      const algorithm = "algorithm";
      const refId = "123abc";
      const created_at = new Date().toISOString();
      result = analyze(sampleId, refId, algorithm);
      expected = {
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
    analysisId = "testid";
    const sequenceIndex = 2;
    result = blastNuvs(analysisId, sequenceIndex);
    expected = {
      type: BLAST_NUVS.REQUESTED,
      analysisId,
      sequenceIndex
    };
    expect(result).toEqual(expected);
  });

  it("removeAnalysis: returns action to remove analysis", () => {
    analysisId = "testid";
    result = removeAnalysis(analysisId);
    expected = {
      type: REMOVE_ANALYSIS.REQUESTED,
      analysisId
    };
    expect(result).toEqual(expected);
  });
});
