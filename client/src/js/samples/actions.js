import {simpleActionCreator} from "../utils";
import {
    WS_UPDATE_SAMPLE,
    WS_REMOVE_SAMPLE,
    WS_UPDATE_ANALYSIS,
    WS_REMOVE_ANALYSIS,
    FIND_READ_FILES,
    FIND_READY_HOSTS,
    GET_SAMPLE,
    CREATE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    REMOVE_SAMPLE,
    FETCH_SAMPLES,
    FIND_ANALYSES,
    GET_ANALYSIS,
    CLEAR_ANALYSIS,
    ANALYZE,
    BLAST_NUVS,
    REMOVE_ANALYSIS,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL,
    GET_ANALYSIS_PROGRESS
} from "../actionTypes";

/**
 * Returns an action that should be dispatched when a sample document is updated via websocket.
 *
 * @func
 * @param update {object} update data passed in the websocket message
 * @returns {object}
 */
export const wsUpdateSample = (update) => ({
    type: WS_UPDATE_SAMPLE,
    update
});

/**
 * Returns an action that should be dispatched when a sample document is removed via websocket.
 *
 * @func
 * @param removed {string} the id for the specific sample
 * @returns {object}
 */
export const wsRemoveSample = (removed) => ({
    type: WS_REMOVE_SAMPLE,
    removed
});

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

export const findReadFiles = simpleActionCreator(FIND_READ_FILES.REQUESTED);

/**
 * Returns action that can trigger an API call for getting all available subtraction hosts.
 *
 * @func
 * @returns {object}
 */
export const findReadyHosts = simpleActionCreator(FIND_READY_HOSTS.REQUESTED);

/**
 * Returns action that can trigger an API call for getting a specific sample.
 *
 * @func
 * @param sampleId {string} the id for the specific sample
 * @returns {object}
 */
export const getSample = (sampleId) => ({
    type: GET_SAMPLE.REQUESTED,
    sampleId
});

/**
 * Returns action that can trigger an API call for creating a new sample.
 *
 * @func
 * @param name {string} unique name for the sample
 * @param isolate {string} the originating isolate
 * @param host {string} the exact host
 * @param locale {string} location in which the sample was collected
 * @param srna {boolean} does the sample contain sRNA reads
 * @param subtraction {string} name of the associated subtraction host genome
 * @param files {object} file ids of one or two files
 * @returns {object}
 */
export const createSample = (name, isolate, host, locale, srna, subtraction, files) => ({
    type: CREATE_SAMPLE.REQUESTED,
    name,
    isolate,
    host,
    locale,
    srna,
    subtraction,
    files
});

/**
 * Returns action that can trigger an API call for modifying a sample.
 *
 * @func
 * @param sampleId {string} unique sample id
 * @param update {object} update data
 * @returns {object}
 */
export const editSample = (sampleId, update) => ({
    type: UPDATE_SAMPLE.REQUESTED,
    sampleId,
    update
});

/**
 * Returns action that can trigger an API call for modifying sample rights.
 *
 * @func
 * @param sampleId {string} unique sample id
 * @param update {object} update data
 * @returns {object}
 */
export const updateSampleRights = (sampleId, update) => ({
    type: UPDATE_SAMPLE_RIGHTS.REQUESTED,
    sampleId,
    update
});

/**
 * Returns action that can trigger an API call for removing a sample.
 *
 * @func
 * @param sampleId {string} unique sample id
 * @returns {object}
 */
export const removeSample = (sampleId) => ({
    type: REMOVE_SAMPLE.REQUESTED,
    sampleId
});

export const fetchSamples = (page) => ({
    type: FETCH_SAMPLES.REQUESTED,
    page
});

/**
 * Returns action for displaying the remove sample modal.
 *
 * @func
 * @returns {object}
 */
export const showRemoveSample = simpleActionCreator(SHOW_REMOVE_SAMPLE);

/**
 * Returns action for hiding the sample modal.
 *
 * @func
 * @returns {object}
 */
export const hideSampleModal = simpleActionCreator(HIDE_SAMPLE_MODAL);

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
