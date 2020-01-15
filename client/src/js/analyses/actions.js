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
    SET_ACTIVE_HIT_ID,
    TOGGLE_FILTER_ORFS,
    TOGGLE_FILTER_SEQUENCES,
    SET_SEARCH_IDS,
    SET_ANALYSIS_SORT_KEY,
    TOGGLE_RESULT_EXPANDED,
    CLEAR_ANALYSES
} from "../app/actionTypes";
import { simpleActionCreator } from "../utils/utils";

export const wsInsertAnalysis = data => ({
    type: WS_INSERT_ANALYSIS,
    data
});

/**
 * Returns an action that should be dispatched when a analysis document is updated via websocket.
 *
 * @func
 * @param data {object} update data passed in the websocket message
 * @returns {object}
 */
export const wsUpdateAnalysis = data => ({
    type: WS_UPDATE_ANALYSIS,
    data
});

/**
 * Returns an action that should be dispatched when a analysis document is removed via websocket.
 *
 * @func
 * @param data {string} the id for the specific analysis
 * @returns {object}
 */
export const wsRemoveAnalysis = data => ({
    type: WS_REMOVE_ANALYSIS,
    data
});

export const collapseAnalysis = simpleActionCreator(COLLAPSE_ANALYSIS);

export const setActiveHitId = id => ({
    type: SET_ACTIVE_HIT_ID,
    id
});

export const setSearchIds = ids => ({
    type: SET_SEARCH_IDS,
    ids
});

export const setAnalysisSortKey = sortKey => ({
    type: SET_ANALYSIS_SORT_KEY,
    sortKey
});

export const setPathoscopeFilter = key => ({
    type: SET_PATHOSCOPE_FILTER,
    key
});

export const toggleFilterORFs = simpleActionCreator(TOGGLE_FILTER_ORFS);

export const toggleFilterSequences = simpleActionCreator(TOGGLE_FILTER_SEQUENCES);

export const togglePathoscopeSortDescending = simpleActionCreator(TOGGLE_SORT_PATHOSCOPE_DESCENDING);

export const toggleResultExpanded = id => ({
    type: TOGGLE_RESULT_EXPANDED,
    id
});

export const toggleShowPathoscopeReads = simpleActionCreator(TOGGLE_SHOW_PATHOSCOPE_READS);

export const findAnalyses = (sampleId, term, page) => ({
    type: FIND_ANALYSES.REQUESTED,
    sampleId,
    term,
    page
});

/**
 * Returns action that can trigger an API call for retrieving a specific analysis.
 *
 * @func
 * @param analysisId {string} unique analysis id
 * @returns {object}
 */
export const getAnalysis = analysisId => ({
    type: GET_ANALYSIS.REQUESTED,
    analysisId
});

export const clearAnalyses = simpleActionCreator(CLEAR_ANALYSES);
export const clearAnalysis = simpleActionCreator(CLEAR_ANALYSIS);

/**
 * Returns action that can trigger an API call for sample analysis.
 *
 * @func
 * @param sampleId {string} unique sample id
 * @param refId {string} unique id for a reference
 * @param algorithm {string} algorithm type
 * @param userId {string} the id of the requesting user
 * @returns {object}
 */
export const analyze = (sampleId, refId, algorithm, subtractionId, userId) => ({
    type: ANALYZE.REQUESTED,
    algorithm,
    refId,
    sampleId,
    subtractionId,
    userId
});

/**
 * Returns action that can trigger an API call for BLASTing NuV analysis contigs.
 *
 * @func
 * @param analysisId {string} unique analysis id
 * @param sequenceIndex {number} index of the sequence
 * @returns {object}
 */
export const blastNuvs = (analysisId, sequenceIndex) => ({
    type: BLAST_NUVS.REQUESTED,
    analysisId,
    sequenceIndex
});

/**
 * Returns action that can trigger an API call for removing an analysis.
 *
 * @func
 * @param analysisId {string} unique analysis id
 * @returns {object}
 */
export const removeAnalysis = analysisId => ({
    type: REMOVE_ANALYSIS.REQUESTED,
    analysisId
});
