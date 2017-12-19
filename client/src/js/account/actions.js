import { simpleActionCreator } from "../utils";
import {
    GET_ACCOUNT,
    UPDATE_ACCOUNT_SETTINGS,
    CHANGE_ACCOUNT_PASSWORD,
    GET_API_KEYS,
    CREATE_API_KEY,
    UPDATE_API_KEY,
    REMOVE_API_KEY,
    LOGOUT
} from "../actionTypes";

export const getAccount = simpleActionCreator(GET_ACCOUNT.REQUESTED);

export const updateAccountSettings = (update) => ({
    type: UPDATE_ACCOUNT_SETTINGS.REQUESTED,
    update
});

export const changePassword = (oldPassword, newPassword) => ({
    type: CHANGE_ACCOUNT_PASSWORD.REQUESTED,
    oldPassword,
    newPassword
});

export const getAPIKeys = simpleActionCreator(GET_API_KEYS.REQUESTED);

export const createAPIKey = (name, permissions, callback) => ({
    type: CREATE_API_KEY.REQUESTED,
    name,
    permissions,
    callback
});

export const updateAPIKey = (keyId, permissions) => ({
    type: UPDATE_API_KEY.REQUESTED,
    keyId,
    permissions
});

export const removeAPIKey = (keyId) => ({
    type: REMOVE_API_KEY.REQUESTED,
    keyId
});

export const logout = simpleActionCreator(LOGOUT.REQUESTED);
