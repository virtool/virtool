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
    CREATE_VIRUS_SET_NAME,
    CREATE_VIRUS_SET_ABBREVIATION
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

export function findViruses (terms) {
    return {
        type: FIND_VIRUSES_REQUESTED,
        terms
    }
}

export function createVirusSetName (name) {
    return {
        type: CREATE_VIRUS_SET_NAME,
        name
    }
}

export function createVirusSetAbbreviation (name) {
    return {
        type: CREATE_VIRUS_SET_ABBREVIATION,
        name
    }
}
