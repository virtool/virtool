import {
    ANALYZE,
    BLAST_NUVS,
    CLEAR_ANALYSIS,
    COLLAPSE_ANALYSIS,
    CROP_PATHOSCOPE,
    FIND_ANALYSES,
    GET_ANALYSIS,
    REMOVE_ANALYSIS,
    SET_PATHOSCOPE_FILTER,
    TOGGLE_SHOW_PATHOSCOPE_MEDIAN,
    TOGGLE_SHOW_PATHOSCOPE_READS,
    WS_REMOVE_ANALYSIS,
    WS_UPDATE_ANALYSIS
} from "../actionTypes";
import {simpleActionCreator} from "../utils";

export const collapseAnalysis = simpleActionCreator(COLLAPSE_ANALYSIS);

export const cropPathoscope = simpleActionCreator(CROP_PATHOSCOPE);

export const setPathoscopeFilter = (key) => ({
    type: SET_PATHOSCOPE_FILTER,
    key
});

export const toggleShowPathoscopeMedia = simpleActionCreator(TOGGLE_SHOW_PATHOSCOPE_MEDIAN);
export const toggleShowPathoscopeReads = simpleActionCreator(TOGGLE_SHOW_PATHOSCOPE_READS);

/**
 * Returns an action that should be dispatched when a analysis document is updated via websocket.
 *
 * @func
 * @param update {object} update data passed in the websocket message
 * @returns {object}
 */
export const wsUpdateAnalysis = (update) => ({
    type: WS_UPDATE_ANALYSIS,
    update
});

/**
 * Returns an action that should be dispatched when a analysis document is removed via websocket.
 *
 * @func
 * @param removed {string} the id for the specific analysis
 * @returns {object}
 */
export const wsRemoveAnalysis = (removed) => ({
    type: WS_REMOVE_ANALYSIS,
    removed
});

/**
 * Returns action that can trigger an API call for retrieving a specific sample.
 *
 * @func
 * @param sampleId {string} unique sample id
 * @returns {object}
 */
export const findAnalyses = (sampleId) => ({
    type: FIND_ANALYSES.REQUESTED,
    sampleId
});

/**
 * Returns action that can trigger an API call for retrieving a specific analysis.
 *
 * @func
 * @param analysisId {string} unique analysis id
 * @returns {object}
 */
export const getAnalysis = (analysisId) => ({
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
export const analyze = (sampleId, refId, algorithm) => {
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
        sampleId
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
export const removeAnalysis = (analysisId) => ({
    type: REMOVE_ANALYSIS.REQUESTED,
    analysisId
});
