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
    CREATE_VIRUS_SET_NAME,
    CREATE_VIRUS_SET_ABBREVIATION,
    CREATE_VIRUS_CLEAR
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

export function createVirusSetName (name) {
    return {
        type: CREATE_VIRUS_SET_NAME,
        name
    }
}

export function createVirusSetAbbreviation (abbreviation) {
    return {
        type: CREATE_VIRUS_SET_ABBREVIATION,
        abbreviation
    }
}

export function createVirusClear () {
    return {
        type: CREATE_VIRUS_CLEAR
    }
}
