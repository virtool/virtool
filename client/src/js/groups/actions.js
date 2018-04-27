import { simpleActionCreator } from "../utils";
import { LIST_GROUPS, CREATE_GROUP, SET_GROUP_PERMISSION, REMOVE_GROUP } from "../actionTypes";

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
export const createGroup = (groupId) => ({
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
export const removeGroup = (groupId) => ({
    type: REMOVE_GROUP.REQUESTED,
    groupId
});
