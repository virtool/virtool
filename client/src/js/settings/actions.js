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
    UPDATE_SETTING
} from "../actionTypes";

export function getSettings () {
    return {
        type: GET_SETTINGS.REQUESTED
    }
}

export function updateSetting (key, value) {
    let update = {};
    update[key] = value;

    return {
        type: UPDATE_SETTING.REQUESTED,
        key,
        value,
        update
    };
}
