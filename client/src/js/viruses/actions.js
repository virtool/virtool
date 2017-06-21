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
    ADD_ISOLATE,
    EDIT_ISOLATE,
    REMOVE_ISOLATE,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_REMOVE_ISOLATE,
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

export function addIsolate (virusId, sourceType, sourceName) {
    return {
        type: ADD_ISOLATE.REQUESTED,
        virusId,
        sourceType,
        sourceName
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

export function removeIsolate (virusId, isolateId) {
    return {
        type: REMOVE_ISOLATE.REQUESTED,
        virusId,
        isolateId
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

export function showRemoveIsolate (virusId) {
    return {
        type: SHOW_REMOVE_ISOLATE,
        virusId
    };
}

export function hideVirusModal () {
    return {
        type: HIDE_VIRUS_MODAL
    };
}
