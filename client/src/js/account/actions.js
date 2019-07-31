/**
 * Redux action creators for use with the active user account.
 *
 * @module account/actions
 */
import { simpleActionCreator } from "../utils/utils";
import {
    GET_ACCOUNT,
    UPDATE_ACCOUNT,
    UPDATE_ACCOUNT_SETTINGS,
    CHANGE_ACCOUNT_PASSWORD,
    GET_API_KEYS,
    CREATE_API_KEY,
    UPDATE_API_KEY,
    REMOVE_API_KEY,
    LOGIN,
    LOGOUT,
    CLEAR_API_KEY
} from "../app/actionTypes";

/**
 * Returns action that can trigger an API call for getting the current account data.
 *
 * @func
 * @returns {object}
 */
export const getAccount = simpleActionCreator(GET_ACCOUNT.REQUESTED);

/**
 * Returns an action that can trigger an API call for updating the current account.
 *
 * @func
 * @param update {object} the update to apply to the account
 * @returns {object}
 */
export const updateAccount = update => ({
    type: UPDATE_ACCOUNT.REQUESTED,
    update
});

/**
 * Returns an action that can trigger an API call for updating the settings for the current account.
 *
 * @func
 * @param update {object} the update to apply to the account
 * @returns {object}
 */
export const updateAccountSettings = update => ({
    type: UPDATE_ACCOUNT_SETTINGS.REQUESTED,
    update
});

/**
 * Returns an action that can trigger an API call for changing the password for the current account.
 *
 * @func
 * @param oldPassword {string} the old account password (used for verification)
 * @param newPassword {string} the new account password
 * @returns {object}
 */
export const changePassword = (oldPassword, newPassword) => ({
    type: CHANGE_ACCOUNT_PASSWORD.REQUESTED,
    oldPassword,
    newPassword
});

/**
 * Returns action that can trigger an API call for getting the API keys owned by the current account.
 *
 * @func
 * @returns {object}
 */
export const getAPIKeys = simpleActionCreator(GET_API_KEYS.REQUESTED);

/**
 * Returns action that can trigger an API call for creating a new API key for the current account.
 *
 * @func
 * @param name {string} a name for the API key
 * @param permissions {object} permissions configuration object for the new API key
 * @returns {object}
 */
export const createAPIKey = (name, permissions) => ({
    type: CREATE_API_KEY.REQUESTED,
    name,
    permissions
});

/**
 * Clears temporarily stored new API keys.
 *
 * @func
 * @returns {object}
 */
export const clearAPIKey = simpleActionCreator(CLEAR_API_KEY);

/**
 * Returns action that can trigger an API call for updating the permissions for an API key owned by the current account.
 *
 * @func
 * @param keyId {string} the unique id for the API key
 * @param permissions {object} permissions configuration object for the new API key
 * @returns {object}
 */
export const updateAPIKey = (keyId, permissions) => ({
    type: UPDATE_API_KEY.REQUESTED,
    keyId,
    permissions
});

/**
 * Returns action that can trigger an API call for removing an API key owned by the current account.
 *
 * @func
 * @param keyId {string} the unique id for the API key
 * @returns {object}
 */
export const removeAPIKey = keyId => ({
    type: REMOVE_API_KEY.REQUESTED,
    keyId
});

/**
 * Returns action that can trigger an API call that will login into a new session.
 *
 * @func
 * @returns {object}
 */
export const login = (username, password, remember, key) => ({
    type: LOGIN.REQUESTED,
    username,
    password,
    remember,
    key
});

/**
 * Returns action that can trigger an API call that will logout the current session.
 *
 * @func
 * @returns {object}
 */
export const logout = simpleActionCreator(LOGOUT.REQUESTED);
