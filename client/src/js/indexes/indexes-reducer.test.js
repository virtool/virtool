import reducer, { initialState as reducerInitialState } from "./reducer";
import {
    WS_UPDATE_INDEX,
    FIND_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    GET_INDEX_HISTORY,
    CLEAR_INDEX_ERROR
} from "../actionTypes";

describe("Indexes Reducer", () => {

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

    it("should handle WS_UPDATE_INDEX", () => {
        state = {
            documents: []
        };
        action = {
            type: "WS_UPDATE_INDEX",
            index_id: 3,
            data: {}
        };
    });

    it("should handle FIND_INDEXES_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_INDEXES_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data,
            isLoading: false,
            errorLoad: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_INDEX_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_INDEX_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_INDEX_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_INDEX_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_UNBUILT_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_UNBUILT_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            unbuilt: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_INDEX_HISTORY_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_INDEX_HISTORY_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            isLoading: true,
            errorLoad: false
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_INDEX_HISTORY_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_INDEX_HISTORY_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            history: action.data,
            isLoading: false,
            errorLoad: false
        };

        expect(result).toEqual(expected);
    });

});
