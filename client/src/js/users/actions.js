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
    CREATE_USER,
    ADD_USER_TO_GROUP,
    REMOVE_USER_FROM_GROUP, EDIT_USER
} from "../actionTypes";

export const listUsers = () => ({
    type: LIST_USERS.REQUESTED
});

export const filterUsers = (term) => ({
    type: FILTER_USERS,
    term
});

export const createUser = (data) => ({
    type: CREATE_USER.REQUESTED,
    ...data
});

export const editUser = (userId, update) => ({
    type: EDIT_USER.REQUESTED,
    update
});

export const addUserToGroup = (userId, groupId) => ({
    type: ADD_USER_TO_GROUP.REQUESTED,
    userId,
    groupId
});

export const removeUserFromGroup = (userId, groupId) => ({
    type: REMOVE_USER_FROM_GROUP.REQUESTED,
    userId,
    groupId
});
