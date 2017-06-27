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
    SET_SOURCE_TYPE_VALUE
} from "../actionTypes";

export function getSettings () {
    return {
        type: GET_SETTINGS.REQUESTED
    }
}

export function setSourceTypeValue (value) {
    return {
        type: SET_SOURCE_TYPE_VALUE,
        value
    }
}

export function updateSettings (update) {
    return {
        type: UPDATE_SETTINGS.REQUESTED,
        update
    };
}
