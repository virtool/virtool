/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { LIST_GROUPS, CREATE_GROUP, SET_GROUP_PERMISSION, REMOVE_GROUP } from "../actionTypes";

export const listGroups = () => {
    return {
        type: LIST_GROUPS.REQUESTED
    };
};

export const createGroup = (groupId) => {
    return {
        type: CREATE_GROUP.REQUESTED,
        groupId
    };
};

export const setGroupPermission = (groupId, permission, value) => {
    return {
        type: SET_GROUP_PERMISSION.REQUESTED,
        groupId,
        permission,
        value
    };
};

export const removeGroup = (groupId) => {
    return {
        type: REMOVE_GROUP.REQUESTED,
        groupId
    };
};
