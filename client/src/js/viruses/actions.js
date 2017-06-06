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
    CREATE_VIRUS,
    TOGGLE_ISOLATE_EDITING,
    TOGGLE_SEQUENCE_EDITING
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

export function findViruses (terms) {
    return {
        type: FIND_VIRUSES.REQUESTED,
        terms
    }
}

export function getVirus (virusId) {
    return {
        type: GET_VIRUS.REQUESTED,
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

export function toggleIsolateEditing () {
    return {
        type: TOGGLE_ISOLATE_EDITING
    };
}

export function toggleSequencEditing () {
    return {
        type: TOGGLE_SEQUENCE_EDITING
    };
}
