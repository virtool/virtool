/**
 * Actions and action creators for working with administrative settings.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { LOAD_SETTINGS, UPDATE_SETTING, SET_SETTING } from "./actionTypes";

export function loadSettings (settings) {
    return {
        type: LOAD_SETTINGS,
        settings
    }
}

export function updateSetting (settingUpdate) {
    return {
        type: UPDATE_SETTING,
        settingUpdate
    }
}

export function setSetting (settingUpdate) {
    return {
        type: SET_SETTING,
        settingUpdate
    }
}
