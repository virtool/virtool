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

describe("Account Action Creators:", () => {

    it("getAccount: returns simple action", () => {
        const result = getAccount();
        const expected = {
            type: "GET_ACCOUNT_REQUESTED",
        };

        expect(result).toEqual(expected);
    });

    it("updateAccount: returns action with account update", () => {

    });

    it("updateAccountSettings: returns action with settings update", () => {

    });

    it("changePassword: returns action for password change", () => {

    });

    it("getAPIKeys: returns simple action", () => {

    });

    it("createAPIKey: returns action for new API key", () => {

    });

    it("clearAPIKey: returns simple action", () => {

    });

    it("updateAPIKey: returns action for API key update", () => {

    });

    it("removeAPIKey: returns action for API key remove", () => {

    });

    it("logout: returns simple action", () => {
        
    });
});
