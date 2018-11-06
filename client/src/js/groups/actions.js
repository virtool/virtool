import { simpleActionCreator } from "../utils/utils";
import {
    WS_INSERT_GROUP,
    WS_UPDATE_GROUP,
    WS_REMOVE_GROUP,
    LIST_GROUPS,
    CREATE_GROUP,
    SET_GROUP_PERMISSION,
    REMOVE_GROUP
} from "../app/actionTypes";

export const wsInsertGroup = data => ({
    type: WS_INSERT_GROUP,
    data
});

export const wsUpdateGroup = data => ({
    type: WS_UPDATE_GROUP,
    data
});

export const wsRemoveGroup = data => ({
    type: WS_REMOVE_GROUP,
    data
});

/**
 * Returns an action that triggers a request for all groups from the API.
 *
 * @func
 */
export const listGroups = simpleActionCreator(LIST_GROUPS.REQUESTED);

/**
 * Returns an action that triggers a API request to create a group with the given `groupId`.
 *
 * @func
 * @param groupId {string} the id for the new group
 * @returns {object}
 */
export const createGroup = groupId => ({
    type: CREATE_GROUP.REQUESTED,
    groupId
});

/**
 * Returns action that can trigger an API request for modifying group permissions.
 *
 * @param groupId {string} the id for the specific group
 * @param permission {string} the specific permission field
 * @param value {boolean} is checked or not
 * @returns {object}
 */
export const setGroupPermission = (groupId, permission, value) => ({
    type: SET_GROUP_PERMISSION.REQUESTED,
    groupId,
    permission,
    value
});

/**
 * Returns an action that triggers a API request to remove a group with the given `groupId`.
 *
 * @func
 * @param groupId {string} the id for the new group
 * @returns {object}
 */
export const removeGroup = groupId => ({
    type: REMOVE_GROUP.REQUESTED,
    groupId
});
