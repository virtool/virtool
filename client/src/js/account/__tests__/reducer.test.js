import {
    CLEAR_API_KEY,
    CREATE_API_KEY,
    GET_ACCOUNT,
    GET_API_KEYS,
    UPDATE_ACCOUNT,
    UPDATE_ACCOUNT_SETTINGS
} from "../../app/actionTypes";
import reducer from "../reducer";

describe("Account Reducer", () => {
    it("should return the initial state when [state=undefined]", () => {
        const result = reducer(undefined, {});
        expect(result).toEqual({
            apiKeys: null,
            newKey: null,
            ready: false
        });
    });

    it("should return the given state on other action types", () => {
        const action = {
            type: "UNHANDLED_ACTION"
        };
        const state = { foo: "bar" };
        const result = reducer(state, action);
        expect(result).toEqual(state);
    });

    it("should handle GET_ACCOUNT_SUCCEEDED", () => {
        const action = {
            type: GET_ACCOUNT.SUCCEEDED,
            data: {
                foo: "bar"
            }
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            foo: "bar",
            ready: true
        });
    });

    it("should handle UPDATE_ACCOUNT_SUCCEEDED", () => {
        const state = {
            apiKeys: []
        };
        const action = {
            type: UPDATE_ACCOUNT.SUCCEEDED,
            data: {
                foo: "bar"
            }
        };
        const result = reducer(state, action);
        expect(result).toEqual({ apiKeys: [], foo: "bar" });
    });

    it("should handle GET_API_KEYS_SUCCEEDED", () => {
        const keys = [{ id: "foo" }, { id: "bar" }];
        const action = {
            type: GET_API_KEYS.SUCCEEDED,
            data: keys
        };
        const result = reducer({}, action);
        expect(result).toEqual({ apiKeys: keys });
    });

    it("should handle CREATE_API_KEY_REQUESTED", () => {
        const state = {
            key: "foo"
        };
        const action = {
            type: CREATE_API_KEY.REQUESTED
        };
        const result = reducer(state, action);
        expect(result).toEqual({
            key: null
        });
    });

    it("should handle CREATE_API_KEY_SUCCEEDED", () => {
        const action = {
            type: CREATE_API_KEY.SUCCEEDED,
            data: {
                key: {
                    id: "foo"
                }
            }
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            newKey: { id: "foo" }
        });
    });

    it("should handle CLEAR_API_KEY", () => {
        const action = {
            type: CLEAR_API_KEY
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            newKey: null
        });
    });

    it("should handle UPDATE_ACCOUNT_SETTINGS_SUCCEEDED", () => {
        const action = {
            type: UPDATE_ACCOUNT_SETTINGS.SUCCEEDED,
            data: {
                foo: "bar"
            }
        };
        const result = reducer({}, action);
        expect(result).toEqual({
            settings: action.data
        });
    });
});
