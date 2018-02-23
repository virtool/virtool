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

export const fetchViruses = simpleActionCreator(FETCH_VIRUSES);

export const getVirus = (virusId) => ({
    type: GET_VIRUS.REQUESTED,
    virusId
});

export const getVirusHistory = (virusId) => ({
    type: GET_VIRUS_HISTORY.REQUESTED,
    virusId
});

export const createVirus = (name, abbreviation) => ({
    type: CREATE_VIRUS.REQUESTED,
    name,
    abbreviation
});

export const editVirus = (virusId, name, abbreviation, schema) => ({
    type: EDIT_VIRUS.REQUESTED,
    virusId,
    name,
    abbreviation,
    schema
});

export const removeVirus = (virusId, history) => ({
    type: REMOVE_VIRUS.REQUESTED,
    virusId,
    history
});

export const addIsolate = (virusId, sourceType, sourceName) => ({
    type: ADD_ISOLATE.REQUESTED,
    virusId,
    sourceType,
    sourceName
});

export const setIsolateAsDefault = (virusId, isolateId) => ({
    type: SET_ISOLATE_AS_DEFAULT.REQUESTED,
    virusId,
    isolateId
});

export const editIsolate = (virusId, isolateId, sourceType, sourceName) => ({
    type: EDIT_ISOLATE.REQUESTED,
    virusId,
    isolateId,
    sourceType,
    sourceName
});

export const removeIsolate = (virusId, isolateId, nextIsolateId) => ({
    type: REMOVE_ISOLATE.REQUESTED,
    virusId,
    isolateId,
    nextIsolateId
});

export const addSequence = (virusId, isolateId, sequenceId, definition, host, sequence) => ({
    type: ADD_SEQUENCE.REQUESTED,
    virusId,
    isolateId,
    sequenceId,
    definition,
    host,
    sequence
});

export const editSequence = (virusId, isolateId, sequenceId, definition, host, sequence) => ({
    type: EDIT_SEQUENCE.REQUESTED,
    virusId,
    isolateId,
    sequenceId,
    definition,
    host,
    sequence
});

export const removeSequence = (virusId, isolateId, sequenceId) => ({
    type: REMOVE_SEQUENCE.REQUESTED,
    virusId,
    isolateId,
    sequenceId
});

export const revert = (virusId, version) => ({
    type: REVERT.REQUESTED,
    virusId,
    version
});

export const uploadImport = (file, onProgress) => ({
    type: UPLOAD_IMPORT.REQUESTED,
    file,
    onProgress
});

export const commitImport = (fileId) => ({
    type: COMMIT_IMPORT.REQUESTED,
    fileId
});

export const selectIsolate = (isolateId) => ({
    type: SELECT_ISOLATE,
    isolateId
});

export const showEditVirus = simpleActionCreator(SHOW_EDIT_VIRUS);

export const showRemoveVirus = simpleActionCreator(SHOW_REMOVE_VIRUS);

export const showAddIsolate = simpleActionCreator(SHOW_ADD_ISOLATE);

export const showEditIsolate = (virusId, isolateId, sourceType, sourceName) => ({
    type: SHOW_EDIT_ISOLATE,
    virusId,
    isolateId,
    sourceType,
    sourceName
});

export const showRemoveIsolate = simpleActionCreator(SHOW_REMOVE_ISOLATE);

export const showAddSequence = simpleActionCreator(SHOW_ADD_SEQUENCE);

export const showEditSequence = (sequenceId) => ({
    type: SHOW_EDIT_SEQUENCE,
    sequenceId
});

export const showRemoveSequence = (sequenceId) => ({
    type: SHOW_REMOVE_SEQUENCE,
    sequenceId
});

export const hideVirusModal = simpleActionCreator(HIDE_VIRUS_MODAL);
