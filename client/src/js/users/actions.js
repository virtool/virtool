/**
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 */

import {
    WS_INSERT_USER,
    WS_UPDATE_USER,
    WS_REMOVE_USER,
    FIND_USERS,
    GET_USER,
    CREATE_USER,
    EDIT_USER,
    REMOVE_USER
} from "../actionTypes";

export const wsInsertUser = data => ({
    type: WS_INSERT_USER,
    data
});

export const wsUpdateUser = data => ({
    type: WS_UPDATE_USER,
    data
});

export const wsRemoveUser = data => ({
    type: WS_REMOVE_USER,
    data
});

/**
 * Returns an action that can trigger an API call for finding users.
 *
 * @func
 * @returns {object}
 */
export const findUsers = (term, page) => ({
    type: FIND_USERS.REQUESTED,
    term,
    page
});

export const getUser = userId => ({
    type: GET_USER.REQUESTED,
    userId
});

/**
 * Returns action that can trigger an API call for creating a new user.
 *
 * @func
 * @param data {object} data used to create a new user
 * @returns {object}
 */
export const createUser = data => ({
    type: CREATE_USER.REQUESTED,
    ...data
});

/**
 * Returns action that can trigger an API call for modifying an existing user.
 *
 * @func
 * @param userId {string} unique user id
 * @param update {object} key-value pairs of new user properties
 * @returns {object}
 */
export const editUser = (userId, update) => ({
    type: EDIT_USER.REQUESTED,
    userId,
    update
});

export const removeUser = userId => ({
    type: REMOVE_USER.REQUESTED,
    userId
});
