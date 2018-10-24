import {
  WS_INSERT_GROUP,
  WS_UPDATE_GROUP,
  WS_REMOVE_GROUP,
  LIST_GROUPS,
  CREATE_GROUP,
  SET_GROUP_PERMISSION,
  REMOVE_GROUP
} from "../actionTypes";
import reducer, {
  initialState as reducerInitialState,
  updateGroup,
  insertGroup
} from "./reducer";

describe("Groups Reducer", () => {
  const initialState = reducerInitialState;
  let state;
  let action;
  let result;
  let expected;

  it("should return the initial state on first pass", () => {
    result = reducer(undefined, {});
    expected = initialState;
    expect(result).toEqual(expected);
  });

  it("should return the given state on other action types", () => {
    action = {
      type: "UNHANDLED_ACTION"
    };
    result = reducer(initialState, action);
    expected = initialState;
    expect(result).toEqual(expected);
  });

  describe("should handle WS_INSERT_GROUP", () => {
    it("if documents are not yet fetched, return state", () => {
      state = { fetched: false };
      action = { type: WS_INSERT_GROUP };
      result = reducer(state, action);
      expected = state;
      expect(result).toEqual(expected);
    });

    it("otherwise insert entry into list", () => {
      state = { fetched: true, list: [] };
      action = {
        type: WS_INSERT_GROUP,
        data: { id: "test" }
      };
      result = reducer(state, action);
      expected = { ...state, list: [{ id: "test" }] };
      expect(result).toEqual(expected);
    });
  });

  it("should handle WS_UPDATE_GROUP", () => {
    state = { list: [{ id: "test", foo: "bar" }] };
    action = {
      type: WS_UPDATE_GROUP,
      data: { id: "test", foo: "baz" }
    };
    result = reducer(state, action);
    expected = { ...state, list: [{ id: "test", foo: "baz" }] };
    expect(result).toEqual(expected);
  });

  it("should handle WS_REMOVE-GROUP", () => {
    state = { list: [{ id: "test" }] };
    action = { type: WS_REMOVE_GROUP, data: ["test"] };
    result = reducer(state, action);
    expected = { ...state, list: [] };
    expect(result).toEqual(expected);
  });

  it("should handle LIST_GROUPS_SUCCEEDED", () => {
    state = { fetched: false, list: null };
    action = {
      type: LIST_GROUPS.SUCCEEDED,
      data: { documents: [] }
    };
    result = reducer(state, action);
    expected = {
      ...state,
      list: { documents: [] },
      fetched: true
    };
    expect(result).toEqual(expected);
  });

  it("should handle CREATE_GROUP_REQUESTED", () => {
    state = {};
    action = {
      type: CREATE_GROUP.REQUESTED
    };
    result = reducer(state, action);
    expected = { ...state, pending: true };
    expect(result).toEqual(expected);
  });

  it("should handle REMOVE_GROUP_REQUESTED", () => {
    state = {};
    action = {
      type: REMOVE_GROUP.REQUESTED
    };
    result = reducer(state, action);
    expected = { ...state, pending: true };
    expect(result).toEqual(expected);
  });

  it("should handle SET_GROUP_PERMISSION_REQUESTED", () => {
    state = {};
    action = {
      type: SET_GROUP_PERMISSION.REQUESTED
    };
    result = reducer(state, action);
    expected = { ...state, pending: true };
    expect(result).toEqual(expected);
  });

  it("should handle CREATE_GROUP_SUCCEEDED", () => {
    state = {};
    action = { type: CREATE_GROUP.SUCCEEDED };
    result = reducer(state, action);
    expected = { ...state, pending: false };
    expect(result).toEqual(expected);
  });

  it("should handle REMOVE_GROUP_SUCCEEDED", () => {
    state = {};
    action = { type: REMOVE_GROUP.SUCCEEDED };
    result = reducer(state, action);
    expected = { ...state, pending: false };
  });

  it("should handle SET_GROUP_PERMISSION_SUCCEEDED", () => {
    state = {};
    action = { type: SET_GROUP_PERMISSION.SUCCEEDED };
    result = reducer(state, action);
    expected = { ...state, pending: false };
    expect(result).toEqual(expected);
  });

  describe("should handle CREATE_GROUP_FAILED", () => {
    it("with 'Group already exists' error", () => {
      state = {};
      action = {
        type: CREATE_GROUP.FAILED,
        message: "Group already exists"
      };
      result = reducer(state, action);
      expected = {
        ...state,
        createError: true,
        pending: false
      };
      expect(result).toEqual(expected);
    });

    it("with some other error", () => {
      state = {};
      action = {
        type: CREATE_GROUP.FAILED,
        message: "different error"
      };
      result = reducer(state, action);
      expected = state;
      expect(result).toEqual(expected);
    });
  });

  describe("Groups Reducer Helper Functions", () => {
    it("updateGroup: should return group list with one permission value of a group updated", () => {
      state = {
        list: [
          {
            id: "tester",
            permissions: {
              test_permission: false
            }
          },
          {
            id: "tester_two",
            permissions: {
              test_permission: false
            }
          }
        ]
      };
      const update = {
        id: "tester",
        permissions: {
          test_permission: true
        }
      };
      result = updateGroup(state, update);
      expected = {
        ...state,
        pending: false,
        list: [
          {
            id: "tester",
            permissions: {
              test_permission: true
            }
          },
          {
            id: "tester_two",
            permissions: {
              test_permission: false
            }
          }
        ]
      };
    });

    it("insertGroup: adds new entry to current list and sorts by id", () => {
      const list = [{ id: "a" }, { id: "d" }, { id: "g" }];
      const entry = { id: "c" };
      result = insertGroup(list, entry);
      expected = [{ id: "a" }, { id: "c" }, { id: "d" }, { id: "g" }];
      expect(result).toEqual(expected);
    });
  });
});
