/**
 * Redux actions and action creators for working with virus data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    WS_UPDATE_VIRUS,
    WS_REMOVE_VIRUS,
    FIND_VIRUSES,
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
    SELECT_SEQUENCE,
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


export function wsUpdateVirus (virusUpdate) {
    return {
        type: WS_UPDATE_VIRUS,
        virusUpdate
    }
}

export function wsRemoveVirus (virusId) {
    return {
        type: WS_REMOVE_VIRUS,
        virusId
    }
}

export function findViruses (term, page) {
    return {
        type: FIND_VIRUSES.REQUESTED,
        term,
        page
    };
}

export function getVirus (virusId) {
    return {
        type: GET_VIRUS.REQUESTED,
        virusId: virusId
    };
}

export function getVirusHistory (virusId) {
    return {
        type: GET_VIRUS_HISTORY.REQUESTED,
        virusId: virusId
    };
}

export function createVirus (name, abbreviation) {
    return {
        type: CREATE_VIRUS.REQUESTED,
        name,
        abbreviation
    };
}

export function editVirus (virusId, name, abbreviation) {
    return {
        type: EDIT_VIRUS.REQUESTED,
        virusId,
        name,
        abbreviation
    };
}

export function removeVirus (virusId, history) {
    return {
        type: REMOVE_VIRUS.REQUESTED,
        virusId,
        history
    };
}

export function addIsolate (virusId, sourceType, sourceName) {
    return {
        type: ADD_ISOLATE.REQUESTED,
        virusId,
        sourceType,
        sourceName
    };
}

export function setIsolateAsDefault (virusId, isolateId) {
    return {
        type: SET_ISOLATE_AS_DEFAULT.REQUESTED,
        virusId,
        isolateId
    };
}

export function editIsolate (virusId, isolateId, sourceType, sourceName) {
    return {
        type: EDIT_ISOLATE.REQUESTED,
        virusId,
        isolateId,
        sourceType,
        sourceName
    };
}

export function removeIsolate (virusId, isolateId, nextIsolateId) {
    return {
        type: REMOVE_ISOLATE.REQUESTED,
        virusId,
        isolateId,
        nextIsolateId
    };
}

export function addSequence (virusId, isolateId, sequenceId, definition, host, sequence) {
    return {
        type: ADD_SEQUENCE.REQUESTED,
        virusId,
        isolateId,
        sequenceId,
        definition,
        host,
        sequence
    };
}

export function editSequence (virusId, isolateId, sequenceId, definition, host, sequence) {
    return {
        type: EDIT_SEQUENCE.REQUESTED,
        virusId,
        isolateId,
        sequenceId,
        definition,
        host,
        sequence
    };
}

export function removeSequence (virusId, isolateId, sequenceId) {
    return {
        type: REMOVE_SEQUENCE.REQUESTED,
        virusId,
        isolateId,
        sequenceId
    };
}

export function revert (virusId, version) {
    return {
        type: REVERT.REQUESTED,
        virusId,
        version
    };
}

export function uploadImport (file, onProgress) {
    return {
        type: UPLOAD_IMPORT.REQUESTED,
        file,
        onProgress
    };
}

export function commitImport (fileId) {
    return {
        type: COMMIT_IMPORT.REQUESTED,
        fileId
    };
}

export function selectIsolate (isolateId) {
    return {
        type: SELECT_ISOLATE,
        isolateId
    };
}

export function selectSequence (sequenceId) {
    return {
        type: SELECT_SEQUENCE,
        sequenceId
    };
}

export function showEditVirus () {
    return {
        type: SHOW_EDIT_VIRUS
    };
}

export function showRemoveVirus () {
    return {
        type: SHOW_REMOVE_VIRUS
    };
}

export function showAddIsolate () {
    return {
        type: SHOW_ADD_ISOLATE
    };
}

export function showEditIsolate (virusId, isolateId, sourceType, sourceName) {
    return {
        type: SHOW_EDIT_ISOLATE,
        virusId,
        isolateId,
        sourceType,
        sourceName
    };
}

export function showRemoveIsolate () {
    return {
        type: SHOW_REMOVE_ISOLATE
    };
}

export function showAddSequence () {
    return {
        type: SHOW_ADD_SEQUENCE
    };
}

export function showEditSequence (sequenceId) {
    return {
        type: SHOW_EDIT_SEQUENCE,
        sequenceId
    };
}

export function showRemoveSequence (sequenceId) {
    return {
        type: SHOW_REMOVE_SEQUENCE,
        sequenceId
    };
}


export function hideVirusModal () {
    return {
        type: HIDE_VIRUS_MODAL
    };
}
