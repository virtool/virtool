import {
    ANALYZE,
    BLAST_NUVS,
    CLEAR_ANALYSES,
    CLEAR_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    REMOVE_ANALYSIS,
    SET_ANALYSIS_ACTIVE_ID,
    SET_ANALYSIS_SORT_KEY,
    SET_AODP_FILTER,
    SET_SEARCH_IDS,
    TOGGLE_ANALYSIS_SORT_DESCENDING,
    TOGGLE_FILTER_ISOLATES,
    TOGGLE_FILTER_ORFS,
    TOGGLE_FILTER_OTUS,
    TOGGLE_FILTER_SEQUENCES,
    TOGGLE_SHOW_PATHOSCOPE_READS,
    WS_INSERT_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    WS_UPDATE_ANALYSIS
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

export const setActiveHitId = id => ({
    type: SET_ANALYSIS_ACTIVE_ID,
    id
});

export const setSearchIds = ids => ({
    type: SET_SEARCH_IDS,
    ids
});

export const setAODPFilter = filterMin => {
    return {
        type: SET_AODP_FILTER,
        filterMin
    };
};

export const setAnalysisSortKey = sortKey => ({
    type: SET_ANALYSIS_SORT_KEY,
    sortKey
});

export const toggleFilterOTUs = simpleActionCreator(TOGGLE_FILTER_OTUS);
export const toggleFilterIsolates = simpleActionCreator(TOGGLE_FILTER_ISOLATES);
export const toggleFilterORFs = simpleActionCreator(TOGGLE_FILTER_ORFS);
export const toggleFilterSequences = simpleActionCreator(TOGGLE_FILTER_SEQUENCES);
export const toggleAnalysisSortDescending = simpleActionCreator(TOGGLE_ANALYSIS_SORT_DESCENDING);
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
 * @param workflow {string} the workflow to run
 * @param subtractionIds {Array} string - the subtractions to use for the analysis
 * @param userId {string} the id of the requesting user
 * @returns {object}
 */
export const analyze = (sampleId, refId, subtractionIds, userId, workflow) => ({
    type: ANALYZE.REQUESTED,
    refId,
    sampleId,
    subtractionIds,
    userId,
    workflow
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
