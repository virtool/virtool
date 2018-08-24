import reducer, {
    initialState as reducerInitialState,
    proxyTestClear
} from "./reducer";
import {
    GET_CONTROL_READAHEAD,
    GET_SETTINGS,
    TEST_PROXY,
    UPDATE_SETTINGS
} from "../actionTypes";

describe("Settings Reducer", () => {

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

    it("should handle GET_SETTINGS_SUCCEEDED", () => {
        state = {};
        action = {
            type: GET_SETTINGS.SUCCEEDED,
            data: { foo: "bar" }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            data: action.data,
            ...proxyTestClear
        };
        expect(result).toEqual(expected);
    });

    it("should handle UPDATE_SETTINGS_SUCCEEDED", () => {
        state = { data: { test: "target" } };
        action = {
            type: UPDATE_SETTINGS.SUCCEEDED,
            update: {
                test: "target_updated"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            data: {
                ...state.data,
                ...action.update
            },
            ...proxyTestClear
        };
        expect(result).toEqual(expected);
    });

    it("should handle UPDATE_SETTINGS_FAILED", () => {
        state = { data: { test: "target" } };
        action = { type: UPDATE_SETTINGS.FAILED };
        result = reducer(state, action);
        expected = {
            ...state,
            data: { ...state.data },
            ...proxyTestClear
        };
        expect(result).toEqual(expected);
    });

    it("should handle GET_CONTROL_READAHEAD_REQUESTED", () => {
        state = {};
        action = {
            type: GET_CONTROL_READAHEAD.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            readaheadPending: true
        };
        expect(result).toEqual(expected);
    });

    it("should handle GET_CONTROL_READAHEAD_SUCCEEDED", () => {
        state = {};
        action = {
            type: GET_CONTROL_READAHEAD.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            readahead: action.data,
            readaheadPending: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle GET_CONTROL_READAHEAD_FAILED", () => {
        state = {};
        action = {
            type: GET_CONTROL_READAHEAD.FAILED
        };
        result = reducer(state, action);
        expected = {
            readaheadPending: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle TEST_PROXY_REQUESTED", () => {
        state = {};
        action = {
            type: TEST_PROXY.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...proxyTestClear,
            proxyTestPending: true
        };
        expect(result).toEqual(expected);
    });

    it("should handle TEST_PROXY_SUCCEEDED", () => {
        state = {};
        action = {
            type: TEST_PROXY.SUCCEEDED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...proxyTestClear,
            proxyTestSucceeded: true
        };
        expect(result).toEqual(expected);
    });

    it("should handle TEST_PROXY_FAILED", () => {
        state = {};
        action = {
            type: TEST_PROXY.FAILED,
            message: "test_failed"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...proxyTestClear,
            proxyTestFailed: true
        };
        expect(result).toEqual(expected);
    });

});
