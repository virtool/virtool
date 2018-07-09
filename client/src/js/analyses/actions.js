import {simpleActionCreator} from "../utils";
import {
    WS_UPDATE_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    FIND_ANALYSES,
    GET_ANALYSIS,
    GET_ANALYSIS_PROGRESS,
    CLEAR_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS
} from "../actionTypes";

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
 * Returns action for getting the current progress state.
 *
 * @func
 * @param jobId {number} the value of the progress
 * @returns {object}
 */
export const getAnalysisProgress = (progress) => ({
    type: GET_ANALYSIS_PROGRESS,
    progress
});

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
