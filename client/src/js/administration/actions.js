import { simpleActionCreator } from "../utils/utils";
import { GET_SETTINGS, UPDATE_SETTINGS, GET_CONTROL_READAHEAD } from "../app/actionTypes";

/**
 * Returns action that can trigger an API call for retrieving settings.
 *
 * @func
 * @returns {object}
 */
export const getSettings = simpleActionCreator(GET_SETTINGS.REQUESTED);

/**
 * Returns action that can trigger an API call for matching search term results.
 *
 * @func
 * @param term {string} user input search term
 * @returns {object}
 */
export const getControlReadahead = (refId, term) => ({
    type: GET_CONTROL_READAHEAD.REQUESTED,
    refId,
    term
});

/**
 * Returns action that can trigger an API call to update a specific setting.
 *
 * @func
 * @param key {string} property name to update
 * @param value {any} new value to replace old value
 * @returns {object}
 */
export const updateSetting = (key, value) => {
    const update = {};
    update[key] = value;
    return updateSettings(update);
};

/**
 * Returns action that can trigger an API call for updating multiple settings fields.
 *
 * @func
 * @param update {object} update data of key-value pairs
 * @returns {object}
 */
export const updateSettings = update => ({
    type: UPDATE_SETTINGS.REQUESTED,
    update
});
