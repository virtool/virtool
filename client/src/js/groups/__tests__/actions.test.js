import {
    WS_INSERT_GROUP,
    WS_UPDATE_GROUP,
    WS_REMOVE_GROUP,
    LIST_GROUPS,
    CREATE_GROUP,
    SET_GROUP_PERMISSION,
    REMOVE_GROUP
} from "../../app/actionTypes";
import {
    wsInsertGroup,
    wsUpdateGroup,
    wsRemoveGroup,
    listGroups,
    createGroup,
    setGroupPermission,
    removeGroup
} from "../actions";

describe("Groups Action Creators:", () => {
    it("wsInsertGroup: returns action for websocket data insert", () => {
        const data = { id: "test" };
        const result = wsInsertGroup(data);
        expect(result).toEqual({
            type: WS_INSERT_GROUP,
            data
        });
    });

    it("wsUpdateGroup: returns action for websocket data update", () => {
        const data = { id: "test", foo: "bar" };
        const result = wsUpdateGroup(data);
        expect(result).toEqual({
            type: WS_UPDATE_GROUP,
            data
        });
    });

    it("wsRemoveGroup: returns action for websocket data remove", () => {
        const data = ["test"];
        const result = wsRemoveGroup(data);
        expect(result).toEqual({
            type: WS_REMOVE_GROUP,
            data
        });
    });

    it("listGroups: returns simple action", () => {
        const result = listGroups();
        expect(result).toEqual({
            type: LIST_GROUPS.REQUESTED
        });
    });

    it("createGroup: returns action to create a new group", () => {
        const groupId = "testerid";
        const result = createGroup(groupId);
        expect(result).toEqual({
            type: CREATE_GROUP.REQUESTED,
            groupId
        });
    });

    it("setGroupPermission: returns action to set specific permissions", () => {
        const groupId = "testerid";
        const permission = "test_permission";
        const value = true;
        const result = setGroupPermission(groupId, permission, value);
        expect(result).toEqual({
            type: SET_GROUP_PERMISSION.REQUESTED,
            groupId,
            permission,
            value
        });
    });

    it("removeGroup: returns action to remove specific group", () => {
        const groupId = "testerid";
        const result = removeGroup(groupId);
        expect(result).toEqual({
            type: REMOVE_GROUP.REQUESTED,
            groupId
        });
    });
});
