import {
    WS_INSERT_INDEX,
    WS_UPDATE_INDEX,
    GET_INDEX,
    GET_UNBUILT,
    GET_INDEX_HISTORY,
    WS_INSERT_HISTORY
} from "../actionTypes";
import reducer, { initialState as reducerInitialState } from "./reducer";

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

    describe("should handle WS_INSERT_HISTORY", () => {
        it("increment modified_otu_count if insert into current ref", () => {
            state = { referenceId: "123abc", modified_otu_count: 3 };
            action = {
                type: WS_INSERT_HISTORY,
                data: { reference: { id: "123abc" } }
            };
            result = reducer(state, action);
            expected = { ...state, modified_otu_count: 4 };
            expect(result).toEqual(expected);
        });

        it("if insert occurs in different reference, return state", () => {
            state = {};
            action = {
                type: WS_INSERT_HISTORY,
                data: { reference: { id: "tester" } }
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });
    });

    describe("should handle WS_INSERT_INDEX", () => {
        it("return state if list empty or insert in different ref", () => {
            state = { fetched: true, referenceId: "123abc" };
            action = {
                type: WS_INSERT_INDEX,
                data: {
                    reference: { id: "tester" }
                }
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("if insert is for current reference index, insert into list", () => {
            state = {
                fetched: true,
                referenceId: "123abc",
                documents: [],
                page: 1,
                per_page: 3
            };
            action = {
                type: WS_INSERT_INDEX,
                data: {
                    reference: { id: "123abc" },
                    version: 0
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [{ ...action.data }],
                modified_otu_count: 0
            };
            expect(result).toEqual(expected);
        });
    });

    describe("should handle WS_UPDATE_INDEX", () => {
        it("if update is for a different reference index, return state", () => {
            state = { referenceId: "123abc" };
            action = {
                type: WS_UPDATE_INDEX,
                data: { reference: { id: "tester" } }
            };
            result = reducer(state, action);
            expected = state;
            expect(result).toEqual(expected);
        });

        it("if update is for current reference, update corresponding entry", () => {
            state = {
                referenceId: "tester",
                documents: [{ id: "foo", reference: { id: "tester" }, version: 0 }]
            };
            action = {
                type: WS_UPDATE_INDEX,
                data: {
                    id: "foo",
                    reference: { id: "tester" },
                    version: 1
                }
            };
            result = reducer(state, action);
            expected = {
                ...state,
                documents: [{ id: "foo", reference: { id: "tester" }, version: 1 }]
            };
            expect(result).toEqual(expected);
        });
    });

    it("should handle LIST_INDEXES_REQUESTED", () => {
        state = {};
        action = {
            type: LIST_INDEXES.REQUESTED,
            refId: "123abc"
        };
        result = reducer(state, action);
        expected = {
            ...state,
            referenceId: "123abc",
            isLoading: true,
            errorLoad: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_INDEXES_SUCCEEDED", () => {
        state = {
            documents: null,
            page: 0
        };
        action = {
            type: LIST_INDEXES.SUCCEEDED,
            data: {
                documents: [{ id: "1" }],
                page: 1
            }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            documents: [{ id: "1" }],
            page: 1,
            isLoading: false,
            errorLoad: false,
            fetched: true,
            refetchPage: false
        };
        expect(result).toEqual(expected);
    });

    it("should handle LIST_INDEXES_FAILED", () => {
        state = {};
        action = { type: LIST_INDEXES.FAILED };
        result = reducer(state, action);
        expected = { ...state, isLoading: false, errorLoad: true };
        expect(result).toEqual(expected);
    });

    it("should handle GET_INDEX_REQUESTED", () => {
        state = {};
        action = { type: GET_INDEX.REQUESTED };
        result = reducer(state, action);
        expected = { ...state, detail: null };
        expect(result).toEqual(expected);
    });

    it("should handle GET_INDEX_SUCCEEDED", () => {
        state = { detail: null };
        action = {
            type: GET_INDEX.SUCCEEDED,
            data: { id: "foo", version: 3 }
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
            type: GET_UNBUILT.SUCCEEDED,
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
            type: GET_INDEX_HISTORY.REQUESTED
        };
        result = reducer(state, action);
        expected = {
            history: {
                isLoading: true,
                errorLoad: false
            }
        };
        expect(result).toEqual(expected);
    });

    it("should handle GET_INDEX_HISTORY_SUCCEEDED", () => {
        state = { history: { documents: null } };
        action = {
            type: GET_INDEX_HISTORY.SUCCEEDED,
            data: { documents: [{ foo: "bar" }], page: 1, per_page: 3 }
        };
        result = reducer(state, action);
        expected = {
            ...state,
            history: {
                ...action.data,
                isLoading: false,
                errorLoad: false
            }
        };
        expect(result).toEqual(expected);
    });

    it("should handle GET_INDEX_HISTORY_FAILED", () => {
        state = { history: null };
        action = { type: GET_INDEX_HISTORY.FAILED };
        result = reducer(state, action);
        expected = { history: { isLoading: false, errorLoad: true } };
        expect(result).toEqual(expected);
    });
});
