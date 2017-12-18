import { simpleActionCreator } from "../utils";
import { LIST_GROUPS, CREATE_GROUP, SET_GROUP_PERMISSION, REMOVE_GROUP } from "../actionTypes";

export const listGroups = simpleActionCreator(LIST_GROUPS.REQUESTED);

export const createGroup = (groupId) => ({
    type: CREATE_GROUP.REQUESTED,
    groupId
});

export const setGroupPermission = (groupId, permission, value) => ({
    type: SET_GROUP_PERMISSION.REQUESTED,
    groupId,
    permission,
    value
});

export const removeGroup = (groupId) => ({
    type: REMOVE_GROUP.REQUESTED,
    groupId
});
