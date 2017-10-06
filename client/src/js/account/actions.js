/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import {
    WS_UPDATE_ACCOUNT,
    GET_ACCOUNT,
    UPDATE_ACCOUNT_SETTINGS,
    CHANGE_ACCOUNT_PASSWORD,
    CREATE_API_KEY,
    UPDATE_API_KEY,
    REMOVE_API_KEY,
    LOGOUT
} from "../actionTypes";
import {GET_API_KEYS} from "../actionTypes";


export function wsUpdateAccount (data) {
    return {
        type: WS_UPDATE_ACCOUNT,
        data
    };
}

export function getAccount () {
    return {
        type: GET_ACCOUNT.REQUESTED
    }
}

export function updateAccountSettings (update) {
    return {
        type: UPDATE_ACCOUNT_SETTINGS.REQUESTED,
        update
    };
}

export function changePassword (oldPassword, newPassword) {
    return {
        type: CHANGE_ACCOUNT_PASSWORD.REQUESTED,
        oldPassword,
        newPassword
    };
}

export function getAPIKeys () {
    return {
        type: GET_API_KEYS.REQUESTED
    };
}

export function createAPIKey (name, permissions, callback) {
    return {
        type: CREATE_API_KEY.REQUESTED,
        name,
        permissions,
        callback
    };
}

export function updateAPIKey (keyId, permissions) {
    return {
        type: UPDATE_API_KEY.REQUESTED,
        keyId,
        permissions
    };
}

export function removeAPIKey (keyId) {
    return {
        type: REMOVE_API_KEY.REQUESTED,
        keyId
    };
}

export function logout () {
    return {
        type: LOGOUT.REQUESTED
    }
}
