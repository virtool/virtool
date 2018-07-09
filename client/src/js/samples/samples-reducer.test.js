import reducer, { initialState as reducerInitialState } from "./reducer";
import {
    FIND_SAMPLES,
    GET_SAMPLE,
    UPDATE_SAMPLE,
    REMOVE_SAMPLE,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL,
    FIND_READY_HOSTS
} from "../actionTypes";

import { map } from "lodash-es";

describe("Samples Reducer", () => {

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

    it("should handle FIND_SAMPLES_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_SAMPLES_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data
        };

        expect(result).toEqual(expected);
    });

    it("should handle FIND_READY_HOSTS_SUCCEEDED", () => {
        state = {};
        action = {
            type: "FIND_READY_HOSTS_SUCCEEDED",
            data: {
                documents: []
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            readyHosts: action.data.documents
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_SAMPLE_REQUESTED", () => {
        state = {};
        action = {
            type: "GET_SAMPLE_REQUESTED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle GET_SAMPLE_SUCCEEDED", () => {
        state = {};
        action = {
            type: "GET_SAMPLE_SUCCEEDED",
            data: {}
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };

        expect(result).toEqual(expected);
    });

    describe("should handle UPDATE_SAMPLE_SUCCEEDED", () => {

        it("when [state.documents=null], returns state", () => {
            state = {
                documents: null
            };
            action = {
                type: "UPDATE_SAMPLE_SUCCEEDED"
            };
            result = reducer(state, action);
            expected = state;
    
            expect(result).toEqual(expected);
        });

        it("otherwise updates target sample", () => {
            state = {
                documents: [
                    { id: "test1" },
                    { id: "test2" }
                ]
            };
            action = {
                type: "UPDATE_SAMPLE_SUCCEEDED",
                data: {
                    id: "test1",
                    update: "update_test"
                }
            };

            result = reducer(state, action);
            expected = {
                documents: [
                    { id: "test1", update: "update_test" },
                    { id: "test2" }
                ]
            };
    
            expect(result).toEqual(expected);
        });

    });

    it("should handle REMOVE_SAMPLE_SUCCEEDED", () => {
        state = {};
        action = {
            type: "REMOVE_SAMPLE_SUCCEEDED"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null,
            analyses: null,
            analysisDetail: null
        };

        expect(result).toEqual(expected);
    });

    it("should handle SHOW_REMOVE_SAMPLE", () => {
        state = {};
        action = {
            type: "SHOW_REMOVE_SAMPLE"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            showRemove: true
        };

        expect(result).toEqual(expected);
    });

    it("should handle HIDE_SAMPLE_MODAL", () => {
        state = {};
        action = {
            type: "HIDE_SAMPLE_MODAL"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            showRemove: false
        };

        expect(result).toEqual(expected);
    });

});
