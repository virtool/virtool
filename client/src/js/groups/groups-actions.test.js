import {
    listGroups,
    createGroup,
    setGroupPermission,
    removeGroup
} from "./actions";
import {
    LIST_GROUPS,
    CREATE_GROUP,
    SET_GROUP_PERMISSION,
    REMOVE_GROUP
} from "../actionTypes";

describe("Groups Action Creators:", () => {

    it("listGroups: returns simple action", () => {
        const result = listGroups();
        const expected = {
            type: "LIST_GROUPS_REQUESTED"
        };

        expect(result).toEqual(expected);
    });

    it("createGroup: returns action to create a new group", () => {
        const groupId = "testerid";
        const result = createGroup(groupId);
        const expected = {
            type: "CREATE_GROUP_REQUESTED",
            groupId
        };

        expect(result).toEqual(expected);
    });

    it("setGroupPermission: returns action to set specific permissions", () => {
        const groupId = "testerid";
        const permission = "test_permission";
        const value = true;
        const result = setGroupPermission(groupId, permission, value);
        const expected = {
            type: "SET_GROUP_PERMISSIONS_REQUESTED",
            groupId,
            permission,
            value
        };

        expect(result).toEqual(expected);
    });

    it("removeGroup: returns action to remove specific group", () => {
        const groupId = "testerid";
        const result = removeGroup(groupId);
        const expected = {
            type: "REMOVE_GROUP_REQUESTED",
            groupId
        };

        expect(result).toEqual(expected);
    });

});
