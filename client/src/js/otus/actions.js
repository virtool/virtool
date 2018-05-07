import { simpleActionCreator } from "../utils";
import {
    FETCH_OTUs,
    GET_OTU,
    GET_OTU_HISTORY,
    CREATE_OTU,
    EDIT_OTU,
    REMOVE_OTU,
    ADD_ISOLATE,
    EDIT_ISOLATE,
    SET_ISOLATE_AS_DEFAULT,
    REMOVE_ISOLATE,
    ADD_SEQUENCE,
    EDIT_SEQUENCE,
    REMOVE_SEQUENCE,
    REVERT,
    UPLOAD_IMPORT,
    COMMIT_IMPORT,
    SELECT_ISOLATE,
    SHOW_EDIT_OTU,
    SHOW_REMOVE_OTU,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_REMOVE_ISOLATE,
    SHOW_ADD_SEQUENCE,
    SHOW_EDIT_SEQUENCE,
    SHOW_REMOVE_SEQUENCE,
    HIDE_OTU_MODAL
} from "../actionTypes";

/**
 * Returns action for retrieving all available OTUs.
 *
 * @func
 * @returns {object}
 */
export const fetchOTUs = simpleActionCreator(FETCH_OTUs);

/**
 * Returns action that can trigger an API call for retrieving a specific OTU.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @returns {object}
 */
export const getOTU = (OTUId) => ({
    type: GET_OTU.REQUESTED,
    OTUId
});

/**
 * Returns action that can trigger an API call for getting a OTU' history.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @returns {object}
 */
export const getOTUHistory = (OTUId) => ({
    type: GET_OTU_HISTORY.REQUESTED,
    OTUId
});

/**
 * Returns action that can trigger an API call for creating a new OTU.
 *
 * @func
 * @param name {string} unique OTU name
 * @param abbreviation {string} unique abbreviation for OTU name
 * @returns {object}
 */
export const createOTU = (name, abbreviation) => ({
    type: CREATE_OTU.REQUESTED,
    name,
    abbreviation
});

/**
 * Returns action that can trigger an API call for modifying a OTU.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param name {string} unique OTU name
 * @param abbreviation {string} unique abbreviation of OTU name
 * @param schema {array} array of sequences in custom order
 * @returns {object}
 */
export const editOTU = (OTUId, name, abbreviation, schema) => ({
    type: EDIT_OTU.REQUESTED,
    OTUId,
    name,
    abbreviation,
    schema
});

/**
 * Returns action that can trigger an API call for removing a OTU.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param history {object} list of all changes made to the OTU
 * @returns {object}
 */
export const removeOTU = (OTUId, history) => ({
    type: REMOVE_OTU.REQUESTED,
    OTUId,
    history
});

/**
 * Returns action that can trigger an API call for adding an isolate to a OTU.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param sourceType {string} category of isolate source types
 * @param sourceName {string} the name of the isolate source
 * @returns {object}
 */
export const addIsolate = (OTUId, sourceType, sourceName) => ({
    type: ADD_ISOLATE.REQUESTED,
    OTUId,
    sourceType,
    sourceName
});

/**
 * Returns action that can trigger an API call for modifying which isolate is made default.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param isolateId {string} unique isolate id
 * @returns {object}
 */
export const setIsolateAsDefault = (OTUId, isolateId) => ({
    type: SET_ISOLATE_AS_DEFAULT.REQUESTED,
    OTUId,
    isolateId
});

/**
 * Returns action that can trigger an API call for modifying an isolate.
 *
 * @func
 * @param OTUIs {string} unique OTU id
 * @param isolateId {string} unique isolate id
 * @param sourceType {string} category of isolate source types
 * @param sourceName {string} the name of the isolate source
 * @returns {object}
 */
export const editIsolate = (OTUId, isolateId, sourceType, sourceName) => ({
    type: EDIT_ISOLATE.REQUESTED,
    OTUId,
    isolateId,
    sourceType,
    sourceName
});

/**
 * Returns action that can trigger an API call for removing an isolate from a OTU.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param isolateId {string} unique isolate id
 * @param nextIsolateId {string} if removed isolate was default,
 * first in resulting list (i.e. the next isolate) becomes default
 * @returns {object}
 */
export const removeIsolate = (OTUId, isolateId, nextIsolateId) => ({
    type: REMOVE_ISOLATE.REQUESTED,
    OTUId,
    isolateId,
    nextIsolateId
});

/**
 * Returns action that can trigger an API call for adding a sequence to an isolate.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param isolateId {string} unique isolate id
 * @param sequenceId {string} unique sequence id
 * @param definition {string} descriptive definition of the sequence
 * @param host {string} the host the sequence originated from
 * @param sequence {string} an abbreviation for the OTU
 * @param segment {string} the schema segment associated with the OTU
 * @returns {object}
 */
export const addSequence = (OTUId, isolateId, sequenceId, definition, host, sequence, segment) => ({
    type: ADD_SEQUENCE.REQUESTED,
    OTUId,
    isolateId,
    sequenceId,
    definition,
    host,
    sequence,
    segment
});

/**
 * Returns action that can trigger an API call for modifying a sequence.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param isolateId {string} unique isolate id
 * @param sequenceId {string} unique sequence id
 * @param definition {string} descriptive definition of the sequence
 * @param host {string} the host the sequence originated from
 * @param sequence {string} an abbreviation for the OTU
 * @param segment {string} the schema segment associated with the OTU
 * @returns {object}
 */
export const editSequence = (OTUId, isolateId, sequenceId, definition, host, sequence, segment) => ({
    type: EDIT_SEQUENCE.REQUESTED,
    OTUId,
    isolateId,
    sequenceId,
    definition,
    host,
    sequence,
    segment
});

/**
 * Returns action that can trigger an API call for removing a sequence from an isolate.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param isolateId {string} unique isolate id
 * @param sequenceId {string} unique sequence id
 * @returns {object}
 */
export const removeSequence = (OTUId, isolateId, sequenceId) => ({
    type: REMOVE_SEQUENCE.REQUESTED,
    OTUId,
    isolateId,
    sequenceId
});

/**
 * Returns action that can trigger an API call for deleting unbuilt changes of a OTU.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param version {string} OTU index version
 * @returns {object}
 */
export const revert = (OTUId, version) => ({
    type: REVERT.REQUESTED,
    OTUId,
    version
});

/**
 * Returns action that can trigger an API call for uploading a OTU database.
 *
 * @func
 * @param file {object} OTU database file
 * @param onProgress {function} function that sets the component's progress state with a numerical value
 * @returns {object}
 */
export const uploadImport = (file, onProgress) => ({
    type: UPLOAD_IMPORT.REQUESTED,
    file,
    onProgress
});

/**
 * Returns action that can trigger an API call for committing a OTU database import.
 *
 * @func
 * @param fileId {string} unique OTU database file id
 * @returns {object}
 */
export const commitImport = (fileId) => ({
    type: COMMIT_IMPORT.REQUESTED,
    fileId
});

/**
 * Returns action for selecting an isolate to view.
 *
 * @func
 * @param isolateId {string} unique isolate id
 * @returns {object}
 */
export const selectIsolate = (isolateId) => ({
    type: SELECT_ISOLATE,
    isolateId
});

/**
 * Returns action for displaying the edit OTU modal.
 *
 * @func
 * @returns {object}
 */
export const showEditOTU = simpleActionCreator(SHOW_EDIT_OTU);

/**
 * Returns action for displaying the remove OTU modal.
 *
 * @func
 * @returns {object}
 */
export const showRemoveOTU = simpleActionCreator(SHOW_REMOVE_OTU);

/**
 * Returns action for displaying the add isolate modal.
 *
 * @func
 * @returns {object}
 */
export const showAddIsolate = simpleActionCreator(SHOW_ADD_ISOLATE);

/**
 * Returns action for displaying the edit isolate modal.
 *
 * @func
 * @param OTUId {string} unique OTU id
 * @param isolateId {string} unique isolate id
 * @param sourceType {string} category of isolate source types
 * @param sourceName {string} the name for the isolate source
 * @returns {object}
 */
export const showEditIsolate = (OTUId, isolateId, sourceType, sourceName) => ({
    type: SHOW_EDIT_ISOLATE,
    OTUId,
    isolateId,
    sourceType,
    sourceName
});

/**
 * Returns action for displaying the remove isolate modal.
 *
 * @func
 * @returns {object}
 */
export const showRemoveIsolate = simpleActionCreator(SHOW_REMOVE_ISOLATE);

/**
 * Returns action for displaying the add sequence modal.
 *
 * @func
 * @returns {object}
 */
export const showAddSequence = simpleActionCreator(SHOW_ADD_SEQUENCE);

/**
 * Returns action for displaying the edit sequence modal.
 *
 * @func
 * @param sequenceId {string} unique sequence id
 * @returns {object}
 */
export const showEditSequence = (sequenceId) => ({
    type: SHOW_EDIT_SEQUENCE,
    sequenceId
});

/**
 * Returns action for displaying the remove sequence modal.
 *
 * @func
 * @param sequenceId {string} unique sequence id
 * @returns {object}
 */
export const showRemoveSequence = (sequenceId) => ({
    type: SHOW_REMOVE_SEQUENCE,
    sequenceId
});

/**
 * Returns action for hiding the OTU modal.
 *
 * @func
 * @returns {object}
 */
export const hideOTUModal = simpleActionCreator(HIDE_OTU_MODAL);
