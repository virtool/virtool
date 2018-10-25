import {
    WS_INSERT_SAMPLE,
    WS_UPDATE_SAMPLE,
    WS_REMOVE_SAMPLE,
    FILTER_SAMPLES,
    LIST_SAMPLES,
    GET_SAMPLE,
    UPDATE_SAMPLE,
    REMOVE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL,
    FIND_READ_FILES,
    FIND_READY_HOSTS
} from "../actionTypes";
import reducer, { initialState as reducerInitialState } from "./reducer";

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
        action = { type: "UNHANDLED_ACTION" };
        result = reducer(initialState, action);
        expected = initialState;
        expect(result).toEqual(expected);
    });

    describe("should handle WS_INSERT_SAMPLE", () => {
        it("returns state if documents have not been fetched", () => {
            state = { fetched: false };
            action = { type: WS_INSERT_SAMPLE };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("inserts entry into current list otherwise", () => {
            state = { fetched: true, documents: [], page: 1, per_page: 3 };
            action = {
                type: WS_INSERT_SAMPLE,
                data: {
                    id: "abc123",
                    name: "test"
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [{ ...action.data }]
            };
            expect(result).toEqual(expected);
        });
    });

    it("should handle WS_UPDATE_SAMPLE", () => {
        state = {
            ...initialState,
            documents: [{ id: "abc123", name: "test" }]
        };
        action = {
            type: WS_UPDATE_SAMPLE,
            data: {
                id: "abc123",
                name: "test-edited"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [{ id: "abc123", name: "test-edited" }]
        };
        expect(result).toEqual(expected);
    });

    it("should handle WS_REMOVE_SAMPLE", () => {
        state = {
            ...initialState,
            documents: [{ id: "abc123", name: "test" }]
        };
        action = {
            type: WS_REMOVE_SAMPLE,
            data: ["abc123"]
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [],
            refetchPage: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_SAMPLES_REQUESTED", () => {
        state = initialState;
        action = {
            type: FILTER_SAMPLES.REQUESTED,
            term: "abc"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            filter: action.term
        };
        expect(result).toEqual(expected);
    });

    it("should handle FILTER_SAMPLES_SUCCEEDED", () => {
        state = {};
        action = {
            type: FILTER_SAMPLES.SUCCEEDED,
            data: { documents: [] }
        };
        result = reducer(state, action);
        expected = { ...state, ...action.data };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_SAMPLES_REQUESTED", () => {
        state = initialState;
        action = {
            type: LIST_SAMPLES.REQUESTED,
            page: 1
        };
        result = reducer(state, action);
        expected = {
            ...state,
            isLoading: true,
            errorLoad: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_SAMPLES_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: LIST_SAMPLES.SUCCEEDED,
            data: {
                documents: [],
                found_count: 0,
                page: 1,
                page_count: 0,
                per_page: 3,
                total_count: 0
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            ...action.data,
            isLoading: false,
            errorLoad: false,
            fetched: true,
            refetchPage: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_SAMPLES_FAILED", () => {
        state = initialState;
        action = {
            type: LIST_SAMPLES.FAILED,
            status: 404,
            message: "Not found"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            isLoading: false,
            errorLoad: true
        };
        expect(result).toEqual(expected);
    });

    it("should handle FIND_READ_FILES_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: FIND_READ_FILES.SUCCEEDED,
            data: {
                documents: [],
                found_count: 0,
                page: 1,
                page_count: 0,
                per_page: 500,
                total_count: 0
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            readFiles: action.data.documents
        };
        expect(result).toEqual(expected);
    });

    it("should handle FIND_READY_HOSTS_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: FIND_READY_HOSTS.SUCCEEDED,
            data: {
                documents: [],
                found_count: 0,
                page: 1,
                page_count: 0,
                per_page: 25,
                total_count: 0
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
        state = initialState;
        action = {
            type: GET_SAMPLE.REQUESTED,
            sampleId: "test"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null
        };
        expect(result).toEqual(expected);
    });

    it("should handle GET_SAMPLE_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: GET_SAMPLE.SUCCEEDED,
            data: {
                id: "123abc",
                name: "test"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };
        expect(result).toEqual(expected);
    });

    it("should handle UPDATE_SAMPLE_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: UPDATE_SAMPLE.SUCCEEDED,
            data: {
                id: "123abc",
                name: "test"
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };
        expect(result).toEqual(expected);
    });

    it("should handle UPDATE_SAMPLE_RIGHTS_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: UPDATE_SAMPLE_RIGHTS.SUCCEEDED,
            data: { foo: "bar" }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: action.data
        };
        expect(result).toEqual(expected);
    });

    it("should handle REMOVE_SAMPLE_SUCCEEDED", () => {
        state = initialState;
        action = {
            type: REMOVE_SAMPLE.SUCCEEDED,
            data: null
        };
        result = reducer(state, action);
        expected = {
            ...state,
            detail: null
        };
        expect(result).toEqual(expected);
    });

    it("should handle SHOW_REMOVE_SAMPLE", () => {
        state = {};
        action = { type: SHOW_REMOVE_SAMPLE };
        result = reducer(state, action);
        expected = { showRemove: true };
        expect(result).toEqual(expected);
    });

    it("should handle HIDE_SAMPLE_MODAL", () => {
        state = {};
        action = { type: HIDE_SAMPLE_MODAL };
        result = reducer(state, action);
        expected = { showRemove: false };
        expect(result).toEqual(expected);
    });
});
