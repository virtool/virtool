/**
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 */

import {
    LIST_USERS,
    FILTER_USERS,
    CREATE_USER,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP, EDIT_USER
} from "../actionTypes";

/**
 * Returns action that can trigger an API call for retrieving all users.
 *
 * @func
 * @returns {object}
 */
export const listUsers = () => ({
    type: LIST_USERS.REQUESTED
});

/**
 * Returns action for filtering users by search term.
 *
 * @func
 * @param term {string} user input search term
 * @returns {object}
 */
export const filterUsers = (term) => ({
    type: FILTER_USERS,
    term
});

/**
 * Returns action that can trigger an API call for creating a new user.
 *
 * @func
 * @param data {object} data used to create a new user
 * @returns {object}
 */
export const createUser = (data) => ({
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

/**
 * Returns action that can trigger an API call for adding a user to a group.
 *
 * @func
 * @param userId {string} unique user id
 * @param groupId {string} unique group id
 * @returns {object}
 */
export const addUserToGroup = (userId, groupId) => ({
    type: ADD_USER_TO_GROUP.REQUESTED,
    userId,
    groupId
});

/**
 * Returns action that can trigger an API call for removing a user from a group.
 *
 * @func
 * @param userId {string} unique user id
 * @param groupId {string} unique group id
 * @returns {object}
 */
export const removeUserFromGroup = (userId, groupId) => ({
    type: REMOVE_USER_FROM_GROUP.REQUESTED,
    userId,
    groupId
});
