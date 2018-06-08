import reducer, { initialState as reducerInitialState } from "./reducer";
import { WS_UPDATE_STATUS, FIND_HMMS, GET_HMM } from "../actionTypes";

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

        it("when [action.data.id='hmm_install']", () => {
            state = {};
            action = {
                type: "WS_UPDATE_STATUS",
                data: {
                    id: "hmm_install",
                    process: "process",
                    ready: true,
                    download_size: 100
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                process: action.data.process,
                ready: action.data.ready,
                size: action.data.download_size
            };

            expect(result).toEqual(expected);
        });

        it("otherwise return state", () => {
            state = {};
            action = {
                type: "WS_UPDATE_STATUS",
                data: {
                    id: "other_id",
                }
            };
            result = reducer(state, action);
            expected = state;

            expect(result).toEqual(expected);
        });

    });

    it("should handle FIND_HMMS_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_HMMS_SUCCEEDED",
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

    it("should handle GET_HMM_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_HMM_REQUESTED",
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
            type: "GET_HMM_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };

        expect(result).toEqual(expected);
    });

});
