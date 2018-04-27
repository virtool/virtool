import reducer, { initialState as reducerInitialState } from "./reducer";
import { FIND_SUBTRACTIONS, LIST_SUBTRACTION_IDS, GET_SUBTRACTION } from "../actionTypes";

describe("Subtraction Reducer", () => {

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

    it("should handle FIND_SUBTRACTIONS_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_SUBTRACTIONS_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle LIST_SUBTRACTION_IDS_SUCCEEDED", () => {
        state = {};
        action = {
            type: "LIST_SUBTRACTION_IDS_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ids: action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_SUBTRACTION_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_SUBTRACTION_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_SUBTRACTION_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_SUBTRACTION_SUCCEEDED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };

        expect(result).toEqual(expected);
    });

});
