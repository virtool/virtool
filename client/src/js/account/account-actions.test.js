import {
  GET_ACCOUNT,
  UPDATE_ACCOUNT,
  UPDATE_ACCOUNT_SETTINGS,
  CHANGE_ACCOUNT_PASSWORD,
  GET_API_KEYS,
  CREATE_API_KEY,
  UPDATE_API_KEY,
  REMOVE_API_KEY,
  LOGOUT,
  CLEAR_API_KEY
} from "../actionTypes";
import {
  getAccount,
  updateAccount,
  updateAccountSettings,
  changePassword,
  getAPIKeys,
  createAPIKey,
  clearAPIKey,
  updateAPIKey,
  removeAPIKey,
  logout
} from "./actions";

describe("Account Action Creators:", () => {
  it("getAccount: returns simple action", () => {
    const result = getAccount();
    const expected = {
      type: GET_ACCOUNT.REQUESTED
    };

    expect(result).toEqual(expected);
  });

  it("updateAccount: returns action with account update", () => {
    const update = { email: "example@test.com" };
    const result = updateAccount(update);
    const expected = {
      type: UPDATE_ACCOUNT.REQUESTED,
      update
    };

    expect(result).toEqual(expected);
  });

  it("updateAccountSettings: returns action with settings update", () => {
    const update = {
      quick_analyze_algorithm: "pathoscope_bowtie"
    };
    const result = updateAccountSettings(update);
    const expected = {
      type: UPDATE_ACCOUNT_SETTINGS.REQUESTED,
      update
    };

    expect(result).toEqual(expected);
  });

  it("changePassword: returns action for password change", () => {
    const oldPassword = "oldpassword";
    const newPassword = "newpassword";
    const result = changePassword(oldPassword, newPassword);
    const expected = {
      type: CHANGE_ACCOUNT_PASSWORD.REQUESTED,
      oldPassword,
      newPassword
    };

    expect(result).toEqual(expected);
  });

  it("getAPIKeys: returns simple action", () => {
    const result = getAPIKeys();
    const expected = {
      type: GET_API_KEYS.REQUESTED
    };

    expect(result).toEqual(expected);
  });

  it("createAPIKey: returns action for new API key", () => {
    const name = "testapi";
    const permissions = {};
    const result = createAPIKey(name, permissions);
    const expected = {
      type: CREATE_API_KEY.REQUESTED,
      name,
      permissions
    };

    expect(result).toEqual(expected);
  });

  it("clearAPIKey: returns simple action", () => {
    const result = clearAPIKey();
    const expected = {
      type: CLEAR_API_KEY
    };

    expect(result).toEqual(expected);
  });

  it("updateAPIKey: returns action for API key update", () => {
    const keyId = "uniqueid";
    const permissions = {};
    const result = updateAPIKey(keyId, permissions);
    const expected = {
      type: UPDATE_API_KEY.REQUESTED,
      keyId,
      permissions
    };

    expect(result).toEqual(expected);
  });

  it("removeAPIKey: returns action for API key remove", () => {
    const keyId = "uniqueid";
    const result = removeAPIKey(keyId);
    const expected = {
      type: REMOVE_API_KEY.REQUESTED,
      keyId
    };

    expect(result).toEqual(expected);
  });

  it("logout: returns simple action", () => {
    const result = logout();
    const expected = {
      type: LOGOUT.REQUESTED
    };

    expect(result).toEqual(expected);
  });
});
