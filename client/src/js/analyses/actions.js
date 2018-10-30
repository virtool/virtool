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
} from "../actionTypes";
import { simpleActionCreator } from "../utils";

export const wsInsertAnalysis = data => ({
    type: WS_INSERT_ANALYSIS,
    data
});

/**
 * Returns an action that should be dispatched when a analysis document is updated via websocket.
 *
 * @func
 * @param update {object} update data passed in the websocket message
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
 * @param removed {string} the id for the specific analysis
 * @returns {object}
 */
export const wsRemoveAnalysis = data => ({
    type: WS_REMOVE_ANALYSIS,
    data
});

export const collapseAnalysis = simpleActionCreator(COLLAPSE_ANALYSIS);

export const toggleExpanded = id => ({
    type: TOGGLE_ANALYSIS_EXPANDED,
    id
});

export const setPathoscopeFilter = key => ({
    type: SET_PATHOSCOPE_FILTER,
    key
});

export const setSortKey = key => ({
    type: SET_PATHOSCOPE_SORT_KEY,
    key
});

export const togglePathoscopeSortDescending = simpleActionCreator(TOGGLE_SORT_PATHOSCOPE_DESCENDING);

export const toggleShowPathoscopeMedian = simpleActionCreator(TOGGLE_SHOW_PATHOSCOPE_MEDIAN);

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

export const clearAnalysis = simpleActionCreator(CLEAR_ANALYSIS);

/**
 * Returns action that can trigger an API call for sample analysis.
 *
 * @func
 * @param sampleId {string} unique sample id
 * @param algorithm {string} algorithm type
 * @returns {object}
 */
export const analyze = (sampleId, refId, algorithm, userId) => {
    const createdAt = new Date();

    const placeholder = {
        algorithm,
        created_at: createdAt.toISOString(),
        ready: false,
        placeholder: true
    };

    return {
        type: ANALYZE.REQUESTED,
        algorithm,
        placeholder,
        refId,
        sampleId,
        userId
    };
};

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
