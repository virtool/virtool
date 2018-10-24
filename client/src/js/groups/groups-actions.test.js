import {
  WS_INSERT_GROUP,
  WS_UPDATE_GROUP,
  WS_REMOVE_GROUP,
  LIST_GROUPS,
  CREATE_GROUP,
  SET_GROUP_PERMISSION,
  REMOVE_GROUP
} from "../actionTypes";
import {
  wsInsertGroup,
  wsUpdateGroup,
  wsRemoveGroup,
  listGroups,
  createGroup,
  setGroupPermission,
  removeGroup
} from "./actions";

describe("Groups Action Creators:", () => {
  let data;
  let groupId;
  let result;
  let expected;

  it("wsInsertGroup: returns action for websocket data insert", () => {
    data = { id: "test" };
    result = wsInsertGroup(data);
    expected = {
      type: WS_INSERT_GROUP,
      data
    };
    expect(result).toEqual(expected);
  });

  it("wsUpdateGroup: returns action for websocket data update", () => {
    data = { id: "test", foo: "bar" };
    result = wsUpdateGroup(data);
    expected = {
      type: WS_UPDATE_GROUP,
      data
    };
    expect(result).toEqual(expected);
  });

  it("wsRemoveGroup: returns action for websocket data remove", () => {
    data = ["test"];
    result = wsRemoveGroup(data);
    expected = {
      type: WS_REMOVE_GROUP,
      data
    };
    expect(result).toEqual(expected);
  });

  it("listGroups: returns simple action", () => {
    result = listGroups();
    expected = {
      type: LIST_GROUPS.REQUESTED
    };
    expect(result).toEqual(expected);
  });

  it("createGroup: returns action to create a new group", () => {
    groupId = "testerid";
    result = createGroup(groupId);
    expected = {
      type: CREATE_GROUP.REQUESTED,
      groupId
    };
    expect(result).toEqual(expected);
  });

  it("setGroupPermission: returns action to set specific permissions", () => {
    groupId = "testerid";
    const permission = "test_permission";
    const value = true;
    result = setGroupPermission(groupId, permission, value);
    expected = {
      type: SET_GROUP_PERMISSION.REQUESTED,
      groupId,
      permission,
      value
    };
    expect(result).toEqual(expected);
  });

  it("removeGroup: returns action to remove specific group", () => {
    groupId = "testerid";
    result = removeGroup(groupId);
    expected = {
      type: REMOVE_GROUP.REQUESTED,
      groupId
    };
    expect(result).toEqual(expected);
  });
});
