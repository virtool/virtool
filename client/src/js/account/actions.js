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
    CREATE_API_KEY,
    CHANGE_PASSWORD,
    LOGOUT
} from "../actionTypes";


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

export function createAPIKey (name, permissions, callback) {
    return {
        type: CREATE_API_KEY.REQUESTED,
        name,
        permissions,
        callback
    };
}

export function logout () {
    return {
        type: LOGOUT.REQUESTED
    }
}
