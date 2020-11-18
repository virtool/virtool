import {
    CLEAR_SAMPLE_SELECTION,
    CREATE_SAMPLE,
    DESELECT_SAMPLES,
    FIND_READ_FILES,
    FIND_SAMPLES,
    GET_SAMPLE,
    GET_LABELS,
    HIDE_SAMPLE_MODAL,
    REMOVE_SAMPLE,
    REPLACE_LEGACY_FILES,
    SELECT_SAMPLE,
    SHOW_REMOVE_SAMPLE,
    UPDATE_SAMPLE,
    UPDATE_LABEL,
    UPDATE_SAMPLE_RIGHTS,
    UPLOAD_SAMPLE_FILE,
    WS_INSERT_SAMPLE,
    WS_REMOVE_SAMPLE,
    WS_UPDATE_SAMPLE
} from "../app/actionTypes";
import { simpleActionCreator } from "../utils/utils";

export const wsInsertSample = data => ({
    type: WS_INSERT_SAMPLE,
    data
});

/**
 * Returns an action that should be dispatched when a sample document is updated via websocket.
 *
 * @func
 * @param data {object} update data passed in the websocket message
 * @returns {object} an action object
 */
export const wsUpdateSample = data => ({
    type: WS_UPDATE_SAMPLE,
    data
});

/**
 * Returns an action that should be dispatched when a sample document is removed via websocket.
 *
 * @func
 * @param removed {string} the id for the specific sample
 * @returns {object}
 */
export const wsRemoveSample = data => ({
    type: WS_REMOVE_SAMPLE,
    data
});

export const findSamples = (term, page = 1, pathoscope = [], nuvs = []) => ({
    type: FIND_SAMPLES.REQUESTED,
    term,
    page,
    pathoscope,
    nuvs
});

export const findReadFiles = simpleActionCreator(FIND_READ_FILES.REQUESTED);

/**
 * Returns action that can trigger an API call for getting a specific sample.
 *
 * @func
 * @param sampleId {string} the id for the specific sample
 * @returns {object}
 */
export const getSample = sampleId => ({
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
export const createSample = (name, isolate, host, locale, libraryType, subtraction, files) => ({
    type: CREATE_SAMPLE.REQUESTED,
    name,
    isolate,
    host,
    locale,
    libraryType,
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
 * @func
 * @param {*} sampleId {string} unique sample id
 * @param {*} update {object} update data
 * @returns {object}
 */
export const labelEdit = (sampleId, update) => ({
    type: UPDATE_LABEL.REQUESTED,
    sampleId,
    update
});

/**
 * Returns action that can trigger an API call to get sample labels.
 *
 * @func
 * @returns {object}
 */
export const getLabels = () => ({
    type: GET_LABELS.REQUESTED,
});

/**
 * Returns action that can trigger an API call for creating a new label.
 * 
 * @func
 * @param name {string} name for label
 * @param color  {string} color name or hex value of label
 * @return {object}
 */
export const createLabel = (name, color) => ({
    type: CREATE_SAMPLE.REQUESTED,
    name,
    color
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

export const uploadSampleFile = (localId, sampleId, suffix, file) => ({
    type: UPLOAD_SAMPLE_FILE.REQUESTED,
    file,
    localId,
    sampleId,
    suffix,
    context: {
        sampleId,
        suffix
    }
});

export const replaceLegacyFiles = sampleId => ({
    type: REPLACE_LEGACY_FILES.REQUESTED,
    sampleId
});

/**
 * Returns action that can trigger an API call for removing a sample.
 *
 * @func
 * @param sampleId {string} unique sample id
 * @returns {object}
 */
export const removeSample = sampleId => ({
    type: REMOVE_SAMPLE.REQUESTED,
    sampleId
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

export const selectSample = sampleId => ({
    type: SELECT_SAMPLE,
    sampleId
});

export const deselectSamples = sampleIds => ({
    type: DESELECT_SAMPLES,
    sampleIds
});

export const clearSampleSelection = simpleActionCreator(CLEAR_SAMPLE_SELECTION);
