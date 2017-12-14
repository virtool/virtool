/**
 * Actions and action creators for working with administrative settings.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    GET_SETTINGS,
    UPDATE_SETTINGS,
    GET_CONTROL_READAHEAD
} from "../actionTypes";

export function getSettings () {
    return {
        type: GET_SETTINGS.REQUESTED
    }
}

export function updateSetting (key, value) {
    let update = {};
    update[key] = value;
    return updateSettings(update);
}

export function updateSettings (update) {
    return {
        type: UPDATE_SETTINGS.REQUESTED,
        update
    };
}

export function getControlReadahead (term) {
    return {
        type: GET_CONTROL_READAHEAD.REQUESTED,
        term
    }
}
