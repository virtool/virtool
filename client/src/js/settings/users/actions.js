/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { LIST_USERS, SELECT_USER, CHANGE_SET_PASSWORD, CLEAR_SET_PASSWORD, SET_FORCE_RESET } from "../../actionTypes";

export const listUsers = () => {
    return {
        type: LIST_USERS.REQUESTED
    };
};

export const selectUser = (userId) => {
    return {
        type: SELECT_USER.REQUESTED,
        userId
    };
};

export const setForceReset = (userId, enabled) => {
    return {
        type: SET_FORCE_RESET.REQUESTED,
        userId: userId,
        enabled: enabled
    };
};

export const changeSetPassword = (password, confirm) => {
    return {
        type: CHANGE_SET_PASSWORD,
        password,
        confirm
    };
};

export const clearSetPassword = () => {
    return {
        type: CLEAR_SET_PASSWORD
    };
};
