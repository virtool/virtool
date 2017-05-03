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
    FIND_VIRUSES_REQUESTED,
    GET_VIRUS_REQUESTED,
    EDIT_VIRUS_REQUESTED,
    REMOVE_VIRUS_REQUESTED
} from "./actionTypes";


export function wsUpdateVirus(virusUpdate) {
    return {
        type: WS_UPDATE_VIRUS,
        virusUpdate
    }
}

export function wsRemoveVirus(virusId) {
    return {
        type: WS_REMOVE_VIRUS,
        virusId
    }
}

export function findViruses () {
    return {
        type: FIND_VIRUSES_REQUESTED
    }
}

export function getVirus (virusId) {
    return {
        type: GET_VIRUS_REQUESTED,
        virusId: virusId
    }
}

export function editVirus (name, abbreviation) {
    let action = {
        type: EDIT_VIRUS_REQUESTED
    };

    if (name) {
        action.name = name;
    }

    if (abbreviation) {
        action.abbreviation = abbreviation;
    }

    return action;
}

export function removeVirus (virusId) {
    return {
        type: REMOVE_VIRUS_REQUESTED,
        virusId: virusId
    }
}
