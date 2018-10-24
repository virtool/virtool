import {
  WS_INSERT_USER,
  WS_UPDATE_USER,
  WS_REMOVE_USER,
  LIST_USERS,
  FILTER_USERS,
  GET_USER,
  CREATE_USER,
  EDIT_USER,
  REMOVE_USER
} from "../actionTypes";
import {
  wsInsertUser,
  wsUpdateUser,
  wsRemoveUser,
  listUsers,
  filterUsers,
  getUser,
  createUser,
  editUser,
  removeUser
} from "./actions";

describe("Users Action Creators:", () => {
  let data;
  let userId;
  let result;
  let expected;

  it("wsInsertUser: returns action to insert websocket data for new user", () => {
    data = {};
    result = wsInsertUser(data);
    expected = {
      type: WS_INSERT_USER,
      data
    };

    expect(result).toEqual(expected);
  });

  it("wsUpdateUser: returns action to update user with websocket data", () => {
    data = {};
    result = wsUpdateUser(data);
    expected = {
      type: WS_UPDATE_USER,
      data
    };

    expect(result).toEqual(expected);
  });

  it("wsRemoveUser: returns action to remove user specified in websocket data", () => {
    data = [];
    result = wsRemoveUser(data);
    expected = {
      type: WS_REMOVE_USER,
      data
    };

    expect(result).toEqual(expected);
  });

  it("listUsers: returns action to list all users", () => {
    const page = 123;
    result = listUsers(page);
    expected = {
      type: LIST_USERS.REQUESTED,
      page
    };

    expect(result).toEqual(expected);
  });

  it("filterUsers: returns action to filter users by term", () => {
    const term = "searchterm";
    result = filterUsers(term);
    expected = {
      type: FILTER_USERS.REQUESTED,
      term
    };

    expect(result).toEqual(expected);
  });

  it("getUser: returns action to fetch user detail", () => {
    userId = "test";
    result = getUser(userId);
    expected = {
      type: GET_USER.REQUESTED,
      userId
    };

    expect(result).toEqual(expected);
  });

  it("createUser: returns action to create a user", () => {
    data = {};
    result = createUser(data);
    expected = {
      type: CREATE_USER.REQUESTED
    };

    expect(result).toEqual(expected);
  });

  it("editUser: returns action to modify a user", () => {
    userId = "testid";
    const update = {};
    result = editUser(userId, update);
    expected = {
      type: EDIT_USER.REQUESTED,
      userId,
      update
    };

    expect(result).toEqual(expected);
  });

  it("removeUser: returns action to remove user", () => {
    userId = "tester";
    result = removeUser(userId);
    expected = {
      type: REMOVE_USER.REQUESTED,
      userId
    };

    expect(result).toEqual(expected);
  });
});
