/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import {
    LIST_USERS,
    FILTER_USERS,
    SET_PASSWORD,
    SET_PRIMARY_GROUP,
    SET_FORCE_RESET,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP
} from "../actionTypes";

export const listUsers = () => {
    return {
        type: LIST_USERS.REQUESTED
    };
};

export const filterUsers = (term) => {
    return {
        type: FILTER_USERS,
        term
    };
};

export const setForceReset = (userId, enabled) => {
    return {
        type: SET_FORCE_RESET.REQUESTED,
        userId: userId,
        enabled: enabled
    };
};

export const setPassword = (userId, password, confirm) => {
    return {
        type: SET_PASSWORD.REQUESTED,
        userId,
        password,
        confirm
    };
};

export const setPrimaryGroup = (userId, primaryGroup) => {
    return {
        type: SET_PRIMARY_GROUP.REQUESTED,
        userId,
        primaryGroup
    };
};

export const addUserToGroup = (userId, groupId) => {
    return {
        type: ADD_USER_TO_GROUP.REQUESTED,
        userId,
        groupId
    };
};

export const removeUserFromGroup = (userId, groupId) => {
    return {
        type: REMOVE_USER_FROM_GROUP.REQUESTED,
        userId,
        groupId
    };
};
