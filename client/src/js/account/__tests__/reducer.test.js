import {
    GET_ACCOUNT,
    UPDATE_ACCOUNT,
    UPDATE_ACCOUNT_SETTINGS,
    CHANGE_ACCOUNT_PASSWORD,
    GET_API_KEYS,
    CREATE_API_KEY,
    CLEAR_API_KEY
} from "../../app/actionTypes";
import reducer, { initialState as reducerInitialState } from "../reducer";

describe("Account Reducer", () => {
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

    it("should handle GET_ACCOUNT_SUCCEEDED", () => {
        state = {};
        action = {
            type: GET_ACCOUNT.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data,
            ready: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle UPDATE_ACCOUNT_SUCCEEDED", () => {
        state = {};
        action = {
            type: UPDATE_ACCOUNT.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_API_KEYS_SUCCEEDED", () => {
        state = {};
        action = {
            type: GET_API_KEYS.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            apiKeys: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle CHANGE_ACCOUNT_PASSWORD_SUCCEEDED", () => {
        state = {};
        action = {
            type: CHANGE_ACCOUNT_PASSWORD.SUCCEEDED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            oldPasswordError: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_API_KEY_REQUESTED", () => {
        state = {};
        action = {
            type: CREATE_API_KEY.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            key: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle CREATE_API_KEY_SUCCEEDED", () => {
        state = {};
        action = {
            type: CREATE_API_KEY.SUCCEEDED,
            data: {
                key: "testkey"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            newKey: action.data.key
        };

        expect(result).toEqual(expected);
    });

    it("should handle CLEAR_API_KEY", () => {
        state = {};
        action = {
            type: CLEAR_API_KEY
        };
        result = reducer(state, action);
        expected = {
            ...state,
            newKey: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle UPDATE_ACCOUNT_SETTINGS_SUCCEEDED", () => {
        state = {};
        action = {
            type: UPDATE_ACCOUNT_SETTINGS.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            settings: action.data
        };

        expect(result).toEqual(expected);
    });
});
