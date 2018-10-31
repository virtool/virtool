import { WS_UPDATE_STATUS, GET_HMM } from "../actionTypes";
import reducer, { initialState as reducerInitialState } from "./reducer";

describe("HMM Reducer", () => {
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

    describe("should handle WS_UPDATE_STATUS", () => {
        it("if status update id === 'hmm'", () => {
            state = {};
            action = {
                type: WS_UPDATE_STATUS,
                data: {
                    id: "hmm",
                    installed: {},
                    process: {},
                    release: {}
                }
            };
            result = reducer(state, action);
            expected = {
                status: {
                    installed: {},
                    process: {},
                    release: {}
                }
            };
            expect(result).toEqual(expected);
        });

        it("otherwise return state", () => {
            state = {};
            action = {
                type: WS_UPDATE_STATUS,
                data: { id: "not_hmm" }
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });
    });

    it("should handle LIST_HMMS_REQUESTED", () => {
        state = {};
        action = { type: LIST_HMMS.REQUESTED };
        result = reducer(state, action);
        expected = {
            isLoading: true,
            errorLoad: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_HMMS_SUCCEEDED", () => {
        state = { documents: null, page: 0 };
        action = {
            type: LIST_HMMS.SUCCEEDED,
            data: { documents: [], page: 1 }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data,
            isLoading: false,
            errorLoad: false,
            fetched: true
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_HMMS_FAILED", () => {
        state = {};
        action = { type: LIST_HMMS.FAILED };
        result = reducer(state, action);
        expected = { isLoading: false, errorLoad: true };
        expect(result).toEqual(expected);
    });

    it("should handle GET_HMM_REQUESTED", () => {
        state = {};
        action = {
            type: GET_HMM.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null
        };
        expect(result).toEqual(expected);
    });

    it("should handle GET_HMM_SUCCEEDED", () => {
        state = {};
        action = {
            type: GET_HMM.SUCCEEDED,
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_HMMS_REQUESTED", () => {
        state = {};
        action = {
            type: FILTER_HMMS.REQUESTED,
            term: "search"
        };
        result = reducer(state, action);
        expected = { filter: "search" };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_HMMS_SUCCEEDED", () => {
        state = {};
        action = {
            type: FILTER_HMMS.SUCCEEDED,
            data: { documents: [] }
        };
        result = reducer(state, action);
        expected = { documents: [] };
        expect(result).toEqual(expected);
    });
});
