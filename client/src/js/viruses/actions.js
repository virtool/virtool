import { simpleActionCreator } from "../utils";
import {
    FETCH_VIRUSES,
    GET_VIRUS,
    GET_VIRUS_HISTORY,
    CREATE_VIRUS,
    EDIT_VIRUS,
    REMOVE_VIRUS,
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
    SHOW_EDIT_VIRUS,
    SHOW_REMOVE_VIRUS,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_REMOVE_ISOLATE,
    SHOW_ADD_SEQUENCE,
    SHOW_EDIT_SEQUENCE,
    SHOW_REMOVE_SEQUENCE,
    HIDE_VIRUS_MODAL
} from "../actionTypes";

/**
 * Returns action for retrieving all available viruses.
 *
 * @func
 * @returns {object}
 */
export const fetchViruses = simpleActionCreator(FETCH_VIRUSES);

/**
 * Returns action that can trigger an API call for retrieving a specific virus.
 *
 * @func
 * @param virusId {string} unique virus id
 * @returns {object}
 */
export const getVirus = (virusId) => ({
    type: GET_VIRUS.REQUESTED,
    virusId
});

/**
 * Returns action that can trigger an API call for getting a virus' history.
 *
 * @func
 * @param virusId {string} unique virus id
 * @returns {object}
 */
export const getVirusHistory = (virusId) => ({
    type: GET_VIRUS_HISTORY.REQUESTED,
    virusId
});

/**
 * Returns action that can trigger an API call for creating a new virus.
 *
 * @func
 * @param name {string} unique virus name
 * @param abbreviation {string} unique abbreviation for virus name
 * @returns {object}
 */
export const createVirus = (name, abbreviation) => ({
    type: CREATE_VIRUS.REQUESTED,
    name,
    abbreviation
});

/**
 * Returns action that can trigger an API call for modifying a virus.
 *
 * @func
 * @param virusId {string} unique virus id
 * @param name {string} unique virus name
 * @param abbreviation {string} unique abbreviation of virus name
 * @param schema {array} array of sequences in custom order
 * @returns {object}
 */
export const editVirus = (virusId, name, abbreviation, schema) => ({
    type: EDIT_VIRUS.REQUESTED,
    virusId,
    name,
    abbreviation,
    schema
});

/**
 * Returns action that can trigger an API call for removing a virus.
 *
 * @func
 * @param virusId {string} unique virus id
 * @param history {object} list of all changes made to the virus
 * @returns {object}
 */
export const removeVirus = (virusId, history) => ({
    type: REMOVE_VIRUS.REQUESTED,
    virusId,
    history
});

/**
 * Returns action that can trigger an API call for adding an isolate to a virus.
 *
 * @func
 * @param virusId {string} unique virus id
 * @param sourceType {string} category of isolate source types
 * @param sourceName {string} the name of the isolate source
 * @returns {object}
 */
export const addIsolate = (virusId, sourceType, sourceName) => ({
    type: ADD_ISOLATE.REQUESTED,
    virusId,
    sourceType,
    sourceName
});

/**
 * Returns action that can trigger an API call for modifying which isolate is made default.
 *
 * @func
 * @param virusId {string} unique virus id
 * @param isolateId {string} unique isolate id
 * @returns {object}
 */
export const setIsolateAsDefault = (virusId, isolateId) => ({
    type: SET_ISOLATE_AS_DEFAULT.REQUESTED,
    virusId,
    isolateId
});

/**
 * Returns action that can trigger an API call for modifying an isolate.
 *
 * @func
 * @param virusIs {string} unique virus id
 * @param isolateId {string} unique isolate id
 * @param sourceType {string} category of isolate source types
 * @param sourceName {string} the name of the isolate source
 * @returns {object}
 */
export const editIsolate = (virusId, isolateId, sourceType, sourceName) => ({
    type: EDIT_ISOLATE.REQUESTED,
    virusId,
    isolateId,
    sourceType,
    sourceName
});

/**
 * Returns action that can trigger an API call for removing an isolate from a virus.
 *
 * @func
 * @param virusId {string} unique virus id
 * @param isolateId {string} unique isolate id
 * @param nextIsolateId {string} if removed isolate was default,
 * first in resulting list (i.e. the next isolate) becomes default
 * @returns {object}
 */
export const removeIsolate = (virusId, isolateId, nextIsolateId) => ({
    type: REMOVE_ISOLATE.REQUESTED,
    virusId,
    isolateId,
    nextIsolateId
});

/**
 * Returns action that can trigger an API call for adding a sequence to an isolate.
 *
 * @func
 * @param virusId {string} unique virus id
 * @param isolateId {string} unique isolate id
 * @param sequenceId {string} unique sequence id
 * @param definition {string} descriptive definition of the sequence
 * @param host {string} the host the sequence originated from
 * @param sequence {string} an abbreviation for the virus
 * @param segment {string} the schema segment associated with the virus
 * @returns {object}
 */
export const addSequence = (virusId, isolateId, sequenceId, definition, host, sequence, segment) => ({
    type: ADD_SEQUENCE.REQUESTED,
    virusId,
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
 * @param virusId {string} unique virus id
 * @param isolateId {string} unique isolate id
 * @param sequenceId {string} unique sequence id
 * @param definition {string} descriptive definition of the sequence
 * @param host {string} the host the sequence originated from
 * @param sequence {string} an abbreviation for the virus
 * @param segment {string} the schema segment associated with the virus
 * @returns {object}
 */
export const editSequence = (virusId, isolateId, sequenceId, definition, host, sequence, segment) => ({
    type: EDIT_SEQUENCE.REQUESTED,
    virusId,
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
 * @param virusId {string} unique virus id
 * @param isolateId {string} unique isolate id
 * @param sequenceId {string} unique sequence id
 * @returns {object}
 */
export const removeSequence = (virusId, isolateId, sequenceId) => ({
    type: REMOVE_SEQUENCE.REQUESTED,
    virusId,
    isolateId,
    sequenceId
});

/**
 * Returns action that can trigger an API call for deleting unbuilt changes of a virus.
 *
 * @func
 * @param virusId {string} unique virus id
 * @param version {string} virus index version
 * @returns {object}
 */
export const revert = (virusId, version) => ({
    type: REVERT.REQUESTED,
    virusId,
    version
});

/**
 * Returns action that can trigger an API call for uploading a virus database.
 *
 * @func
 * @param file {object} virus database file
 * @param onProgress {function} function that sets the component's progress state with a numerical value
 * @returns {object}
 */
export const uploadImport = (file, onProgress) => ({
    type: UPLOAD_IMPORT.REQUESTED,
    file,
    onProgress
});

/**
 * Returns action that can trigger an API call for committing a virus database import.
 *
 * @func
 * @param fileId {string} unique virus database file id
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
 * Returns action for displaying the edit virus modal.
 *
 * @func
 * @returns {object}
 */
export const showEditVirus = simpleActionCreator(SHOW_EDIT_VIRUS);

/**
 * Returns action for displaying the remove virus modal.
 *
 * @func
 * @returns {object}
 */
export const showRemoveVirus = simpleActionCreator(SHOW_REMOVE_VIRUS);

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
 * @param virusId {string} unique virus id
 * @param isolateId {string} unique isolate id
 * @param sourceType {string} category of isolate source types
 * @param sourceName {string} the name for the isolate source
 * @returns {object}
 */
export const showEditIsolate = (virusId, isolateId, sourceType, sourceName) => ({
    type: SHOW_EDIT_ISOLATE,
    virusId,
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
 * Returns action for hiding the virus modal.
 *
 * @func
 * @returns {object}
 */
export const hideVirusModal = simpleActionCreator(HIDE_VIRUS_MODAL);
