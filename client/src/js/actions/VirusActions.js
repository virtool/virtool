/**
 * Redux actions and action creators for working with virus data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { LOAD_VIRUSES, UPDATE_VIRUS, REMOVE_VIRUS } from "./actionTypes";

export function loadViruses(viruses) {
    return {
        type: LOAD_VIRUSES,
        viruses
    }
}

export function removeVirus(virusId) {
    return {
        type: REMOVE_VIRUS,
        virusId
    }
}

export function updateVirus(virusUpdate) {
    return {
        type: UPDATE_VIRUS,
        virusUpdate
    }
}